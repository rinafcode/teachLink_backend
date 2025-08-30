import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelVersion } from '../entities/model-version.entity';
import { VersionStatus } from '../enums';
import { MLModel } from '../entities/ml-model.entity';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ModelVersioningService {
  constructor(
    @InjectRepository(ModelVersion)
    private readonly versionRepository: Repository<ModelVersion>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
  ) {}

  async createVersion(
    modelId: string,
    version: string,
    description?: string,
    parentVersionId?: string,
  ): Promise<ModelVersion> {
    const model = await this.modelRepository.findOne({ where: { id: modelId } });
    if (!model) {
      throw new NotFoundException(`Model with ID ${modelId} not found`);
    }

    // Check if version already exists
    const existingVersion = await this.versionRepository.findOne({
      where: { modelId, version },
    });

    if (existingVersion) {
      throw new BadRequestException(`Version ${version} already exists for this model`);
    }

    // Validate parent version if provided
    if (parentVersionId) {
      const parentVersion = await this.versionRepository.findOne({
        where: { id: parentVersionId, modelId },
      });
      if (!parentVersion) {
        throw new NotFoundException(`Parent version ${parentVersionId} not found`);
      }
    }

    const modelVersion = this.versionRepository.create({
      modelId,
      version,
      description,
      parentVersionId,
      status: VersionStatus.DRAFT,
    });

    return await this.versionRepository.save(modelVersion);
  }

  async getVersion(versionId: string): Promise<ModelVersion> {
    const version = await this.versionRepository.findOne({
      where: { id: versionId },
      relations: ['model', 'deployments'],
    });

    if (!version) {
      throw new NotFoundException(`Version with ID ${versionId} not found`);
    }

    return version;
  }

  async getModelVersions(
    modelId: string,
    page: number = 1,
    limit: number = 10,
    status?: VersionStatus,
  ): Promise<{ versions: ModelVersion[]; total: number }> {
    const query = this.versionRepository.createQueryBuilder('version')
      .where('version.modelId = :modelId', { modelId })
      .orderBy('version.createdAt', 'DESC');

    if (status) {
      query.andWhere('version.status = :status', { status });
    }

    const total = await query.getCount();
    const versions = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { versions, total };
  }

  async updateVersion(
    versionId: string,
    updates: Partial<ModelVersion>,
  ): Promise<ModelVersion> {
    const version = await this.getVersion(versionId);
    
    Object.assign(version, updates);
    return await this.versionRepository.save(version);
  }

  async deleteVersion(versionId: string): Promise<void> {
    const version = await this.getVersion(versionId);

    // Check if version is deployed
    if (version.deployments && version.deployments.length > 0) {
      const activeDeployments = version.deployments.filter(
        d => d.status === 'active',
      );
      if (activeDeployments.length > 0) {
        throw new BadRequestException('Cannot delete version with active deployments');
      }
    }

    // Delete associated artifacts
    if (version.artifactPath) {
      await this.deleteArtifact(version.artifactPath);
    }

    await this.versionRepository.remove(version);
  }

  async saveModelArtifact(
    versionId: string,
    modelData: Buffer,
    metadata: Record<string, any>,
  ): Promise<string> {
    const version = await this.getVersion(versionId);
    
    // Generate artifact path
    const artifactPath = this.generateArtifactPath(version.modelId, version.version);
    
    // Save model artifact
    await this.saveArtifact(artifactPath, modelData);
    
    // Calculate model hash
    const modelHash = this.calculateModelHash(modelData);
    
    // Update version with artifact information
    version.artifactPath = artifactPath;
    version.modelHash = modelHash;
    version.metadata = { ...version.metadata, ...metadata };
    
    await this.versionRepository.save(version);
    
    return artifactPath;
  }

  async loadModelArtifact(versionId: string): Promise<{ data: Buffer; metadata: Record<string, any> }> {
    const version = await this.getVersion(versionId);
    
    if (!version.artifactPath) {
      throw new NotFoundException('No artifact found for this version');
    }
    
    const data = await this.loadArtifact(version.artifactPath);
    return { data, metadata: version.metadata || {} };
  }

  async getVersionLineage(versionId: string): Promise<any> {
    const version = await this.getVersion(versionId);
    const lineage = await this.buildVersionLineage(version);
    return lineage;
  }

  async compareVersions(versionId1: string, versionId2: string): Promise<any> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    if (version1.modelId !== version2.modelId) {
      throw new BadRequestException('Cannot compare versions from different models');
    }

    return {
      version1: {
        id: version1.id,
        version: version1.version,
        accuracy: version1.accuracy,
        precision: version1.precision,
        recall: version1.recall,
        f1Score: version1.f1Score,
        trainedAt: version1.trainedAt,
        hyperparameters: version1.hyperparameters,
      },
      version2: {
        id: version2.id,
        version: version2.version,
        accuracy: version2.accuracy,
        precision: version2.precision,
        recall: version2.recall,
        f1Score: version2.f1Score,
        trainedAt: version2.trainedAt,
        hyperparameters: version2.hyperparameters,
      },
      comparison: {
        accuracyDiff: (version2.accuracy || 0) - (version1.accuracy || 0),
        precisionDiff: (version2.precision || 0) - (version1.precision || 0),
        recallDiff: (version2.recall || 0) - (version1.recall || 0),
        f1ScoreDiff: (version2.f1Score || 0) - (version1.f1Score || 0),
        hyperparameterChanges: this.compareHyperparameters(
          version1.hyperparameters,
          version2.hyperparameters,
        ),
      },
    };
  }

  async tagVersion(versionId: string, tag: string): Promise<ModelVersion> {
    const version = await this.getVersion(versionId);
    
    const metadata = version.metadata || {};
    metadata.tags = metadata.tags || [];
    
    if (!metadata.tags.includes(tag)) {
      metadata.tags.push(tag);
    }
    
    version.metadata = metadata;
    return await this.versionRepository.save(version);
  }

  async getVersionsByTag(modelId: string, tag: string): Promise<ModelVersion[]> {
    return await this.versionRepository
      .createQueryBuilder('version')
      .where('version.modelId = :modelId', { modelId })
      .andWhere("version.metadata->>'tags' LIKE :tag", { tag: `%${tag}%` })
      .orderBy('version.createdAt', 'DESC')
      .getMany();
  }

  async promoteVersion(versionId: string, targetEnvironment: string): Promise<ModelVersion> {
    const version = await this.getVersion(versionId);
    
    if (version.status !== VersionStatus.TRAINED && version.status !== VersionStatus.VALIDATED) {
      throw new BadRequestException('Version must be trained or validated before promotion');
    }
    
    const metadata = version.metadata || {};
    metadata.promotedTo = metadata.promotedTo || [];
    
    if (!metadata.promotedTo.includes(targetEnvironment)) {
      metadata.promotedTo.push(targetEnvironment);
    }
    
    version.metadata = metadata;
    return await this.versionRepository.save(version);
  }

  private generateArtifactPath(modelId: string, version: string): string {
    const timestamp = Date.now();
    const sanitizedModelId = modelId.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `models/${sanitizedModelId}/${sanitizedVersion}_${timestamp}.model`;
  }

  private async saveArtifact(artifactPath: string, data: Buffer): Promise<void> {
    const fullPath = path.join(process.cwd(), 'artifacts', artifactPath);
    const dir = path.dirname(fullPath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, data);
  }

  private async loadArtifact(artifactPath: string): Promise<Buffer> {
    const fullPath = path.join(process.cwd(), 'artifacts', artifactPath);
    return await fs.readFile(fullPath);
  }

  private async deleteArtifact(artifactPath: string): Promise<void> {
    try {
      const fullPath = path.join(process.cwd(), 'artifacts', artifactPath);
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore errors if file doesn't exist
    }
  }

  private calculateModelHash(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async buildVersionLineage(version: ModelVersion): Promise<any> {
    const lineage = {
      current: version,
      parents: [],
      children: [],
      siblings: [],
    };

    // Find parent versions
    if (version.parentVersionId) {
      const parent = await this.versionRepository.findOne({
        where: { id: version.parentVersionId },
      });
      if (parent) {
        lineage.parents.push(parent);
      }
    }

    // Find child versions
    const children = await this.versionRepository.find({
      where: { parentVersionId: version.id },
    });
    lineage.children = children;

    // Find sibling versions (same parent)
    if (version.parentVersionId) {
      const siblings = await this.versionRepository.find({
        where: { parentVersionId: version.parentVersionId },
      });
      lineage.siblings = siblings.filter(s => s.id !== version.id);
    }

    return lineage;
  }

  private compareHyperparameters(
    hyperparams1: Record<string, any>,
    hyperparams2: Record<string, any>,
  ): Record<string, { old: any; new: any; changed: boolean }> {
    const allKeys = new Set([
      ...Object.keys(hyperparams1 || {}),
      ...Object.keys(hyperparams2 || {}),
    ]);

    const comparison: Record<string, { old: any; new: any; changed: boolean }> = {};

    for (const key of allKeys) {
      const oldValue = hyperparams1?.[key];
      const newValue = hyperparams2?.[key];
      const changed = oldValue !== newValue;

      comparison[key] = {
        old: oldValue,
        new: newValue,
        changed,
      };
    }

    return comparison;
  }
} 