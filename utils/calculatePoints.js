const pointRules = require('./pointRules');

function calculatePoints(perf, format) {
  const rules = pointRules[format];
  if (!rules) return 0;

  let points = 0;

  // BATTING
  const { batting } = perf;
  const batRules = rules.batting;

  if (batting) {
    points += batting.runs * (batRules.run || 0);
    points += batting.fours * (batRules.boundaryBonus || 0);
    points += batting.sixes * (batRules.sixBonus || 0);

    // Duck penalty
    if (batting.isDuck && batting.ballsFaced > 0) {
      points += (batRules.duck || 0);
    }

    // 50 / 100 bonus
    if (batting.runs >= 100 && batRules.century) {
      points += batRules.century;
    } else if (batting.runs >= 50 && batRules.halfCentury) {
      points += batRules.halfCentury;
    }

    // Strike Rate
    const sr = batting.ballsFaced > 0 ? (batting.runs / batting.ballsFaced) * 100 : 0;
    if (batRules.strikeRate && Array.isArray(batRules.strikeRate)) {
      for (const rule of batRules.strikeRate) {
        if (rule.minBalls && batting.ballsFaced < rule.minBalls) continue;
        if (rule.below && sr < rule.below) points += rule.points;
        if (rule.above && sr > rule.above) points += rule.points;
      }
    }
  }

  // BOWLING
  const { bowling } = perf;
  const bowlRules = rules.bowling;

  if (bowling) {
    points += bowling.wickets * (bowlRules.wicket || 0);
    points += bowling.maidenOvers * (bowlRules.maiden || 0);

    if (bowlRules["3w"] && bowling.wickets >= 3) points += bowlRules["3w"];
    if (bowlRules["4w"] && bowling.wickets >= 4) points += bowlRules["4w"];
    if (bowlRules["5w"] && bowling.wickets >= 5) points += bowlRules["5w"];

    // Economy Rate
    const economy = bowling.overs > 0 ? bowling.runsConceded / bowling.overs : 0;
    if (bowlRules.economyRate && Array.isArray(bowlRules.economyRate)) {
      for (const rule of bowlRules.economyRate) {
        if (rule.minOvers && bowling.overs < rule.minOvers) continue;
        if (rule.below && economy < rule.below) points += rule.points;
        if (rule.above && economy > rule.above) points += rule.points;
      }
    }
  }

  // FIELDING
  const { fielding } = perf;
  const fieldRules = rules.fielding;

  if (fielding) {
    points += fielding.catches * (fieldRules.catch || 0);
    points += fielding.stumpings * (fieldRules.stumping || 0);

    // Two ways to handle run outs (some systems split thrower/catcher)
    if (fielding.runOuts !== undefined && fieldRules.runOut !== undefined) {
      points += fielding.runOuts * fieldRules.runOut;
    } else {
      if (fielding.runOutThrower) points += fielding.runOutThrower * (fieldRules.runOutThrower || 0);
      if (fielding.runOutCatcher) points += fielding.runOutCatcher * (fieldRules.runOutCatcher || 0);
    }
  }

  return points;
}

module.exports = calculatePoints;
