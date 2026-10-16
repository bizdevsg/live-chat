import { Global, Module } from "@nestjs/common";
import { AuditLogService } from "./audit/audit-log.service";
import { SecurityEventService } from "./security/security-event.service";
import { EncryptionService } from "./security/encryption.service";
import { PresenceService } from "./presence/presence.service";
import { AiRunRecorderService } from "./ai-run-recorder.service";

@Global()
@Module({
  providers: [AuditLogService, SecurityEventService, EncryptionService, PresenceService, AiRunRecorderService],
  exports: [AuditLogService, SecurityEventService, EncryptionService, PresenceService, AiRunRecorderService],
})
export class CommonModule {}
