import { publicCacheRules } from "../lib/public-cache";

// Emit rule objects to append to the zone's http_request_cache_settings phase.
// Do not replace a zone ruleset: it may contain unrelated rules.
console.log(JSON.stringify(publicCacheRules(), null, 2));
