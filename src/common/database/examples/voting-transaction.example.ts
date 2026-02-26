import { Injectable, Logger } from '@nestjs/common';
import { TransactionService } from '../transaction.service';

/**
 * Example: DAO Voting Transaction
 * Demonstrates atomic voting operations with proper locking
 */
@Injectable()
export class VotingTransactionExample {
  private readonly logger = new Logger(VotingTransactionExample.name);

  constructor(private readonly transactionService: TransactionService) {}

  /**
   * Cast a vote in DAO proposal
   * Ensures vote is recorded, counts are updated, and user can't double-vote
   */
  async castVote(
    userId: string,
    proposalId: string,
    voteType: 'for' | 'against' | 'abstain',
    votingPower: number,
  ): Promise<any> {
    return this.transactionService.runWithIsolationLevel(
      'SERIALIZABLE', // Prevent concurrent voting issues
      async (manager) => {
        // 1. Check if user already voted
        const existingVote = await manager.query(
          'SELECT * FROM votes WHERE user_id = $1 AND proposal_id = $2',
          [userId, proposalId],
        );

        if (existingVote && existingVote.length > 0) {
          throw new Error('User has already voted on this proposal');
        }

        // 2. Check if proposal is still active
        const proposal = await manager.query(
          'SELECT * FROM proposals WHERE id = $1 AND status = $2 FOR UPDATE',
          [proposalId, 'active'],
        );

        if (!proposal || proposal.length === 0) {
          throw new Error('Proposal not found or not active');
        }

        // 3. Verify user has voting power
        const user = await manager.query(
          'SELECT voting_power FROM users WHERE id = $1',
          [userId],
        );

        if (!user || user.length === 0 || user[0].voting_power < votingPower) {
          throw new Error('Insufficient voting power');
        }

        // 4. Record the vote
        const vote = await manager.query(
          'INSERT INTO votes (user_id, proposal_id, vote_type, voting_power) VALUES ($1, $2, $3, $4) RETURNING *',
          [userId, proposalId, voteType, votingPower],
        );

        // 5. Update proposal vote counts
        const updateField = voteType === 'for' ? 'votes_for' : voteType === 'against' ? 'votes_against' : 'votes_abstain';
        await manager.query(
          `UPDATE proposals SET ${updateField} = ${updateField} + $1, total_votes = total_votes + $1 WHERE id = $2`,
          [votingPower, proposalId],
        );

        // 6. Check if proposal reached quorum
        const updatedProposal = await manager.query(
          'SELECT * FROM proposals WHERE id = $1',
          [proposalId],
        );

        const { total_votes, quorum_required } = updatedProposal[0];
        
        if (total_votes >= quorum_required) {
          await manager.query(
            'UPDATE proposals SET quorum_reached = true WHERE id = $1',
            [proposalId],
          );

          this.logger.log(`Proposal ${proposalId} reached quorum`);
        }

        // 7. Create activity log
        await manager.query(
          'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
          [userId, 'vote_cast', 'proposal', proposalId],
        );

        this.logger.log(`Vote cast: ${userId} voted ${voteType} on ${proposalId}`);

        return vote[0];
      },
    );
  }

  /**
   * Change vote (if allowed)
   */
  async changeVote(
    userId: string,
    proposalId: string,
    newVoteType: 'for' | 'against' | 'abstain',
  ): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Get existing vote
      const existingVote = await manager.query(
        'SELECT * FROM votes WHERE user_id = $1 AND proposal_id = $2 FOR UPDATE',
        [userId, proposalId],
      );

      if (!existingVote || existingVote.length === 0) {
        throw new Error('No existing vote found');
      }

      const { vote_type: oldVoteType, voting_power } = existingVote[0];

      if (oldVoteType === newVoteType) {
        throw new Error('Vote type is the same');
      }

      // 2. Check if proposal allows vote changes
      const proposal = await manager.query(
        'SELECT * FROM proposals WHERE id = $1 AND status = $2 AND allow_vote_change = true FOR UPDATE',
        [proposalId, 'active'],
      );

      if (!proposal || proposal.length === 0) {
        throw new Error('Proposal does not allow vote changes or is not active');
      }

      // 3. Update vote counts - remove old vote
      const oldField = oldVoteType === 'for' ? 'votes_for' : oldVoteType === 'against' ? 'votes_against' : 'votes_abstain';
      await manager.query(
        `UPDATE proposals SET ${oldField} = ${oldField} - $1 WHERE id = $2`,
        [voting_power, proposalId],
      );

      // 4. Update vote counts - add new vote
      const newField = newVoteType === 'for' ? 'votes_for' : newVoteType === 'against' ? 'votes_against' : 'votes_abstain';
      await manager.query(
        `UPDATE proposals SET ${newField} = ${newField} + $1 WHERE id = $2`,
        [voting_power, proposalId],
      );

      // 5. Update vote record
      await manager.query(
        'UPDATE votes SET vote_type = $1, changed_at = NOW() WHERE user_id = $2 AND proposal_id = $3',
        [newVoteType, userId, proposalId],
      );

      // 6. Log the change
      await manager.query(
        'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'vote_changed', 'proposal', proposalId, JSON.stringify({ from: oldVoteType, to: newVoteType })],
      );

      this.logger.log(`Vote changed: ${userId} changed from ${oldVoteType} to ${newVoteType} on ${proposalId}`);

      return { success: true, oldVoteType, newVoteType };
    });
  }

  /**
   * Execute proposal (after voting period ends)
   */
  async executeProposal(proposalId: string): Promise<any> {
    return this.transactionService.runInTransaction(async (manager) => {
      // 1. Get proposal with lock
      const proposal = await manager.query(
        'SELECT * FROM proposals WHERE id = $1 AND status = $2 FOR UPDATE',
        [proposalId, 'active'],
      );

      if (!proposal || proposal.length === 0) {
        throw new Error('Proposal not found or not active');
      }

      const {
        votes_for,
        votes_against,
        total_votes,
        quorum_required,
        approval_threshold,
      } = proposal[0];

      // 2. Check if voting period ended
      const now = new Date();
      const endTime = new Date(proposal[0].voting_end_time);
      
      if (now < endTime) {
        throw new Error('Voting period has not ended');
      }

      // 3. Check quorum
      if (total_votes < quorum_required) {
        await manager.query(
          'UPDATE proposals SET status = $1, executed_at = NOW() WHERE id = $2',
          ['failed_quorum', proposalId],
        );

        return { success: false, reason: 'Quorum not reached' };
      }

      // 4. Check approval threshold
      const approvalRate = (votes_for / total_votes) * 100;
      
      if (approvalRate < approval_threshold) {
        await manager.query(
          'UPDATE proposals SET status = $1, executed_at = NOW() WHERE id = $2',
          ['rejected', proposalId],
        );

        return { success: false, reason: 'Approval threshold not met' };
      }

      // 5. Execute proposal actions
      const actions = await manager.query(
        'SELECT * FROM proposal_actions WHERE proposal_id = $1 ORDER BY execution_order',
        [proposalId],
      );

      for (const action of actions) {
        // Execute each action (transfer funds, update settings, etc.)
        await this.executeProposalAction(manager, action);
      }

      // 6. Mark proposal as executed
      await manager.query(
        'UPDATE proposals SET status = $1, executed_at = NOW() WHERE id = $2',
        ['executed', proposalId],
      );

      // 7. Log execution
      await manager.query(
        'INSERT INTO activity_logs (action, entity_type, entity_id, metadata) VALUES ($1, $2, $3, $4)',
        ['proposal_executed', 'proposal', proposalId, JSON.stringify({ votes_for, votes_against, total_votes })],
      );

      this.logger.log(`Proposal executed: ${proposalId}`);

      return { success: true, proposalId, status: 'executed' };
    });
  }

  /**
   * Helper to execute individual proposal actions
   */
  private async executeProposalAction(manager: any, action: any): Promise<void> {
    const { action_type, parameters } = action;

    switch (action_type) {
      case 'transfer_funds':
        await manager.query(
          'UPDATE users SET balance = balance + $1 WHERE id = $2',
          [parameters.amount, parameters.recipient],
        );
        break;

      case 'update_setting':
        await manager.query(
          'UPDATE settings SET value = $1 WHERE key = $2',
          [parameters.value, parameters.key],
        );
        break;

      // Add more action types as needed
      default:
        this.logger.warn(`Unknown action type: ${action_type}`);
    }
  }
}
