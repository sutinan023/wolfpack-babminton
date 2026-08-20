export const LEVEL_RATING = Object.freeze({BG:2,'BG+':3,N:4,'N+':5,S:6,P:7,'P+':8});
export const LEVELS = Object.freeze(Object.keys(LEVEL_RATING));
export function levelToRating(level){
  if(!(level in LEVEL_RATING)) throw new Error(`Unknown level: ${level}`);
  return LEVEL_RATING[level];
}
export const RESULT = Object.freeze({A:'A',DRAW:'draw',B:'B'});
