import { createZodDto } from "nestjs-zod";
import { CreateClientLogSchema, ClientLogListQuerySchema } from "@packetpulse/types";

export class CreateClientLogDto extends createZodDto(CreateClientLogSchema) {}
export class ClientLogListQueryDto extends createZodDto(ClientLogListQuerySchema) {}
