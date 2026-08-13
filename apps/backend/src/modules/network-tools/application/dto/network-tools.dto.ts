import { createZodDto } from "nestjs-zod";
import { RunNetworkToolSchema } from "@packetpulse/types";

export class RunNetworkToolDto extends createZodDto(RunNetworkToolSchema) {}
