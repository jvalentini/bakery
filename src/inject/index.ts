export {
  deepMergeJson,
  type InjectContentOptions,
  injectContent,
  injectJson,
  validateNoNewMarkers,
} from './engine.js'

export {
  detectCommentStyle,
  extractIndent,
  getMarkerNames,
  getMarkerPatterns,
  parseMarkers,
  validateMarkerPairs,
} from './parser.js'
export { processInjections } from './processor.js'
export {
  type CommentStyle,
  type InjectionDefinition,
  InjectionDefinitionSchema,
  type InjectionManifestEntry,
  InjectionManifestEntrySchema,
  type InjectionPosition,
  InjectionPositionSchema,
  type InjectionResult,
  type MarkerRegion,
  type ProcessInjectionsOptions,
  type TemplateContextLike,
} from './types.js'
