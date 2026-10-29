import { DataSource, IsNull, Repository } from 'typeorm';

import { AppDataSource } from '../../core/db';
import { CourseAllocation } from '../allocations';
import { BatchMember, MentorMentee } from '../batches';
import { Submission } from '../submissions';
import { User, UserRoleHistory } from '../users';

export class User360Repository {
  private readonly userRepo: Repository<User>;
  private readonly roleHistoryRepo: Repository<UserRoleHistory>;
  private readonly batchMemberRepo: Repository<BatchMember>;
  private readonly mentorMenteeRepo: Repository<MentorMentee>;
  private readonly allocationRepo: Repository<CourseAllocation>;
  private readonly submissionRepo: Repository<Submission>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.userRepo = dataSource.getRepository(User);
    this.roleHistoryRepo = dataSource.getRepository(UserRoleHistory);
    this.batchMemberRepo = dataSource.getRepository(BatchMember);
    this.mentorMenteeRepo = dataSource.getRepository(MentorMentee);
    this.allocationRepo = dataSource.getRepository(CourseAllocation);
    this.submissionRepo = dataSource.getRepository(Submission);
  }

  public async getUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id: userId, deletedAt: IsNull() },
    });
  }

  public async getRoleHistory(userId: string): Promise<UserRoleHistory[]> {
    return this.roleHistoryRepo
      .createQueryBuilder('rh')
      .where('rh.userId = :userId', { userId })
      .andWhere('rh.deletedAt IS NULL')
      .orderBy('rh.fromAt', 'ASC')
      .take(5000)
      .getMany();
  }

  public async getBatchMemberships(userId: string): Promise<BatchMember[]> {
    return this.batchMemberRepo
      .createQueryBuilder('bm')
      .innerJoinAndSelect('bm.batch', 'batch')
      .where('bm.userId = :userId', { userId })
      .andWhere('bm.deletedAt IS NULL')
      .orderBy('bm.joinedAt', 'DESC')
      .take(5000)
      .getMany();
  }

  public async getMentorMappings(userId: string): Promise<MentorMentee[]> {
    return this.mentorMenteeRepo
      .createQueryBuilder('mm')
      .leftJoinAndSelect('mm.batch', 'batch')
      .leftJoinAndSelect('mm.mentor', 'mentor')
      .leftJoinAndSelect('mm.mentee', 'mentee')
      .where('(mm.menteeId = :userId OR mm.mentorId = :userId)', { userId })
      .andWhere('mm.deletedAt IS NULL')
      .orderBy('mm.startDate', 'DESC')
      .take(5000)
      .getMany();
  }

  public async getCourseAllocations(userId: string): Promise<CourseAllocation[]> {
    return this.allocationRepo
      .createQueryBuilder('ca')
      .innerJoinAndSelect('ca.course', 'course')
      .leftJoinAndSelect('ca.batch', 'batch')
      .where('ca.userId = :userId', { userId })
      .andWhere('ca.deletedAt IS NULL')
      .orderBy('ca.startDate', 'DESC')
      .take(5000)
      .getMany();
  }

  public async getSubmissions(userId: string): Promise<Submission[]> {
    return this.submissionRepo
      .createQueryBuilder('submission')
      .innerJoinAndSelect('submission.courseAllocation', 'allocation')
      .leftJoinAndSelect('submission.assignment', 'assignment')
      .leftJoinAndSelect('submission.batch', 'batch')
      .leftJoinAndSelect('submission.grader', 'grader')
      .where('allocation.userId = :userId', { userId })
      .andWhere('submission.deletedAt IS NULL')
      .orderBy('submission.submittedAt', 'DESC')
      .take(5000)
      .getMany();
  }
}

export const user360Repository = new User360Repository();
