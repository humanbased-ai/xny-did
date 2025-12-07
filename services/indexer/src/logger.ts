// logger.ts
import { log } from "@graphprotocol/graph-ts"

export abstract class LoggerBackend {
  abstract debug(message: string, args: string[]): void
  abstract info(message: string, args: string[]): void
  abstract warn(message: string, args: string[]): void
  abstract error(message: string, args: string[]): void
}

class DefaultLoggerBackend extends LoggerBackend {
  debug(message: string, args: string[]): void {
    log.debug(message, [])
  }
  
  info(message: string, args: string[]): void {
    log.info(message, [])
  }
  
  warn(message: string, args: string[]): void {
    log.warning(message, [])
  }
  
  error(message: string, args: string[]): void {
    log.error(message, [])
  }
}

export class Logger {
  static backend: LoggerBackend = new DefaultLoggerBackend()

  static debug(message: string, args: string[]): void {
    Logger.backend.debug(message, args)
  }

  static info(message: string, args: string[]): void {
    Logger.backend.info(message, args)
  }

  static warn(message: string, args: string[]): void {
    Logger.backend.warn(message, args)
  }

  static error(message: string, args: string[]): void {
    Logger.backend.error(message, args)
  }
}
