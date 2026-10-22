import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class ConnectWhatsAppDto {
  @IsIn(["NOWEB", "WEBJS", "GOWS", "WPP"])
  engine: "NOWEB" | "WEBJS" | "GOWS" | "WPP" = "NOWEB";
}

export class SendWhatsAppMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;
}
