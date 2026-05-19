import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('user_alert_dismissals')
@Unique('UQ_user_alert_dismissals_user_alert', ['userId', 'alertId'])
@Index('IDX_user_alert_dismissals_user_expires', ['userId', 'expiresAt'])
export class UserAlertDismissalOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /**
   * Stable string ID built by the helpers in `domain/alert-id.ts`. 128 chars
   * is a generous cap — current IDs are well under 80 chars but leaving
   * room for future scope tokens (e.g. `service-due-today:{uuid}:{period}:{currency}`).
   */
  @Column({ type: 'varchar', length: 128 })
  alertId: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  dismissedAt: Date;

  /**
   * When the dismiss stops applying. Null = "never expires" (for the
   * future persistent-dismiss case — currently rejected at use-case
   * layer with ALR_001). Per-day dismissals set this to midnight in the
   * user's TZ at the time of dismiss.
   */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
