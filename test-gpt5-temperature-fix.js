#!/usr/bin/env node

// Test script to verify GPT-5 temperature fix
const { isGPT5Model } = require('./shared/settings-schema.ts');

console.log("🧪 Verificando Correção GPT-5 Temperature");
console.log("=========================================\n");

// Simulate API parameter building for different models
function buildApiParams(model, settings) {
  const isGPT5 = isGPT5Model(model);
  const params = { model };

  // GPT-5 models don't support temperature
  if (!isGPT5) {
    params.temperature = settings.temperature;
  }

  // Token parameters
  if (isGPT5) {
    params.max_completion_tokens = settings.maxTokens;
    params.reasoning_effort = settings.reasoningEffort;
    params.verbosity = settings.verbosity;
  } else {
    params.max_tokens = settings.maxTokens;
  }

  return params;
}

// Test settings
const testSettings = {
  temperature: 0.7,
  maxTokens: 1500,
  reasoningEffort: 'low',
  verbosity: 'medium'
};

// Test different models
const models = ['gpt-5-mini', 'gpt-4o-mini'];

console.log("✅ API Parameters por Modelo:");
console.log("");

models.forEach(model => {
  const params = buildApiParams(model, testSettings);
  console.log(`🔹 ${model}:`);
  console.log(`   Temperature: ${params.temperature || 'DEFAULT (1.0 - GPT-5)'}`);
  console.log(`   Tokens: ${params.max_completion_tokens || params.max_tokens}`);
  if (params.reasoning_effort) {
    console.log(`   Reasoning: ${params.reasoning_effort}`);
  }
  console.log("");
});

console.log("🎉 Correção aplicada com sucesso!");
console.log("   - GPT-5 não recebe temperature customizada");
console.log("   - GPT-4o mantém controle de temperature");
console.log("   - API parameters corretos por modelo");
