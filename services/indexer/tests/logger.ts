import {LoggerBackend} from "../src/logger"

export class TestLoggerBackend extends LoggerBackend {
  messages: Array<string> = new Array<string>()

  debug(message: string, args: string[]): void {
    this.messages.push(message)
  }
  
  info(message: string, args: string[]): void {
    this.messages.push(message)
  }
  
  warn(message: string, args: string[]): void {
    this.messages.push(message)
  }
  
  error(message: string, args: string[]): void {
    this.messages.push(message)
  }
}