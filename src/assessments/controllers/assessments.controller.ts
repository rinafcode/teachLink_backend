import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Patch, HttpCode, HttpStatus } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger"
import { JwtAuthGuard } from "src/auth/guards/jwt.guard";
import { AssessmentsService } from "../providers/assessments.service";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/auth/decorators/roles.decorator";
import { UserRole } from "src/users/entities/user.entity";
import { CreateAssessmentDto } from "../dto/create-assessment.dto";
import { StartAssessmentDto } from "../dto/start-assessment.dto";
import { SubmitAssessmentDto } from "../dto/submit-assessment.dto";
import { AssessmentStatus } from "../entities/assessment.entity";

@ApiTags("Assessments")
@Controller("assessments")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: "Create a new assessment" })
  @ApiResponse({ status: 201, description: "Assessment successfully created" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  async createAssessment(@Body() createAssessmentDto: CreateAssessmentDto, @Req() req): Promise<any> {
    return this.assessmentsService.createAssessment(createAssessmentDto, req.user.id)
  }

  @Get()
  @ApiOperation({ summary: 'Get all published assessments' })
  @ApiQuery({ name: 'courseId', required: false, description: 'Filter by course ID' })
  @ApiResponse({ status: 200, description: 'List of assessments retrieved successfully' })
  async findAllAssessments(@Query('courseId') courseId?: string) {
    return this.assessmentsService.findAllAssessments(courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assessment by ID' })
  @ApiResponse({ status: 200, description: 'Assessment retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async findAssessmentById(@Param('id') id: string) {
    return this.assessmentsService.findAssessmentById(id);
  }

  @Post("start")
  @ApiOperation({ summary: "Start an assessment attempt" })
  @ApiResponse({ status: 201, description: "Assessment attempt started successfully" })
  @ApiResponse({ status: 400, description: "Cannot start assessment (max attempts reached, not available, etc.)" })
  @ApiResponse({ status: 404, description: "Assessment not found" })
  async startAssessment(@Body() startAssessmentDto: StartAssessmentDto, @Req() req) {
    return this.assessmentsService.startAssessment(startAssessmentDto, req.user.id)
  }

  @Post("submit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Submit assessment answers" })
  @ApiResponse({ status: 200, description: "Assessment submitted successfully" })
  @ApiResponse({ status: 400, description: "Cannot submit assessment (not in progress, time expired, etc.)" })
  @ApiResponse({ status: 404, description: "Assessment attempt not found" })
  async submitAssessment(@Body() submitAssessmentDto: SubmitAssessmentDto, @Req() req) {
    return this.assessmentsService.submitAssessment(submitAssessmentDto, req.user.id)
  }

  @Get("attempts/:attemptId/results")
  @ApiOperation({ summary: "Get assessment results and feedback" })
  @ApiResponse({ status: 200, description: "Assessment results retrieved successfully" })
  @ApiResponse({ status: 400, description: "Assessment still in progress" })
  @ApiResponse({ status: 404, description: "Assessment attempt not found" })
  async getAssessmentResults(@Param('attemptId') attemptId: string, @Req() req) {
    return this.assessmentsService.getAssessmentResults(attemptId, req.user.id)
  }

  @Get("users/attempts")
  @ApiOperation({ summary: "Get user assessment attempts" })
  @ApiQuery({ name: "assessmentId", required: false, description: "Filter by assessment ID" })
  @ApiResponse({ status: 200, description: "User attempts retrieved successfully" })
  async getUserAttempts(@Query('assessmentId') assessmentId: string, @Req() req) {
    return this.assessmentsService.getUserAttempts(req.user.id, assessmentId)
  }

  @Get(':id/statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get assessment statistics' })
  @ApiResponse({ status: 200, description: 'Assessment statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Assessment not found' })
  async getAssessmentStatistics(@Param('id') id: string) {
    return this.assessmentsService.getAssessmentStatistics(id);
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: "Update assessment status" })
  @ApiResponse({ status: 200, description: "Assessment status updated successfully" })
  @ApiResponse({ status: 403, description: "Insufficient permissions" })
  @ApiResponse({ status: 404, description: "Assessment not found" })
  async updateAssessmentStatus(@Param('id') id: string, @Body('status') status: AssessmentStatus, @Req() req) {
    return this.assessmentsService.updateAssessmentStatus(id, status, req.user.id)
  }
}
