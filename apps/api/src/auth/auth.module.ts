import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ClaraSsoController } from "./clara-sso/clara-sso.controller";
import { ClaraSsoService } from "./clara-sso/clara-sso.service";
import { ClaraSsoConfigService } from "./clara-sso/clara-sso.config";
import { ClaraSsoStateService } from "./clara-sso/clara-sso-state.service";
import { AgentModule } from "../agent/agent.module";
import { OidcProviderController } from "./oidc-provider/oidc-provider.controller";
import { OidcProviderConfigService } from "./oidc-provider/oidc-provider.config";
import { OidcProviderService } from "./oidc-provider/oidc-provider.service";

@Module({
  imports: [JwtModule.register({}), AgentModule],
  controllers: [AuthController, ClaraSsoController, OidcProviderController],
  providers: [
    AuthService,
    ClaraSsoService,
    ClaraSsoConfigService,
    ClaraSsoStateService,
    OidcProviderConfigService,
    OidcProviderService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
