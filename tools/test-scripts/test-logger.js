#!/usr/bin/env node

// Demo script for the new logging system
const { logger, log, setDebugLogging, getLoggingStatus } = require('./shared/logger.ts');

console.log("🎯 Sistema de Logging Centralizado - Demo");
console.log("========================================\n");

// 1. Status atual
console.log("1. Status Atual:");
console.log(getLoggingStatus());
console.log();

// 2. Logs normais (sempre ativos)
console.log("2. Logs Normais (sempre ativos):");
logger.info("Esta é uma mensagem informativa");
logger.warn("Este é um aviso");
logger.error("Este é um erro");
console.log();

// 3. Logs debug (desativados por padrão)
console.log("3. Logs Debug (desativados por padrão):");
logger.debug("Este debug NÃO deve aparecer");
console.log();

// 4. Ativar debug logs
console.log("4. Ativando Debug Logs:");
setDebugLogging(true);
console.log(getLoggingStatus());
console.log();

// 5. Agora debug aparece
console.log("5. Debug Logs Ativados:");
logger.debug("Agora este debug DEVE aparecer");
console.log();

// 6. Usando funções específicas
console.log("6. Funções Específicas por Módulo:");
log.llm("Mensagem do LLM streaming");
log.audio("Mensagem do audio player");
log.voice("Mensagem da voice session");
log.ws("Mensagem do WebSocket");
log.api("Mensagem da API");
console.log();

// 7. Desativar debug novamente
console.log("7. Desativando Debug Logs:");
setDebugLogging(false);
logger.debug("Este debug NÃO deve aparecer novamente");
console.log();

// 8. Resumo
console.log("🎉 Sistema de Logging KISS:");
console.log("✅ Centralizado em shared/logger.ts");
console.log("✅ Fácil ativação/desativação");
console.log("✅ Funções específicas por módulo");
console.log("✅ Debug desabilitado por padrão (production-safe)");
console.log("✅ Seguindo princípio KISS - Simples e Eficaz!");
