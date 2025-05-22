const pointRules = {
    Test: {
      player_in: {
        live: 4
      },
      batting: {
        run: 1,
        boundaryBonus: 1,
        sixBonus: 2,
        duck: -2,
        halfCentury: 4,
        century: 8,
        strikeRate: null // Not applicable
      },
      bowling: {
        wicket: 16,
        maiden: 4,
        "4w": 4,
        "5w": 8,
        economyRate: null // Not applicable
      },
      fielding: {
        catch: 8,
        stumping: 12,
        runOutThrower: 6,
        runOutCatcher: 6
      }
    },
  
    ODI: {
      player_in: {
        live: 4
      },
      batting: {
        run: 1,
        boundaryBonus: 1,
        sixBonus: 2,
        duck: -2,
        halfCentury: 4,
        century: 8,
        strikeRate: [
          { below: 50, minBalls: 20, points: -2 }
        ]
      },
      bowling: {
        wicket: 12,
        maiden: 4,
        "3w": 4,
        "5w": 8,
        economyRate: [
          { below: 4, minOvers: 5, points: 3 },
          { above: 7, minOvers: 5, points: -2 }
        ]
      },
      fielding: {
        catch: 6,
        stumping: 6,
        runOut: 6
      }
    },
  
    T20: {
      batting: {
        run: 1,
        boundaryBonus: 1,
        sixBonus: 2,
        duck: -2,
        strikeRate: [
          { below: 100, minBalls: 10, points: -2 },
          { above: 170, minBalls: 10, points: 6 }
        ]
      },
      bowling: {
        wicket: 25,
        maiden: 8,
        "3w": 4,
        "5w": 8,
        economyRate: [
          { below: 6, minOvers: 2, points: 3 },
          { above: 10, minOvers: 2, points: -2 }
        ]
      },
      fielding: {
        catch: 8,
        stumping: 12,
        runOut: 12
      }
    },
  
    T10: {
      batting: {
        run: 1,
        boundaryBonus: 1,
        sixBonus: 2,
        duck: -2,
        strikeRate: [
          { below: 100, minBalls: 5, points: -2 },
          { above: 170, minBalls: 5, points: 6 }
        ]
      },
      bowling: {
        wicket: 20,
        maiden: 10,
        "3w": 4,
        "5w": 8,
        economyRate: [
          { below: 6, minOvers: 1, points: 3 },
          { above: 10, minOvers: 1, points: -2 }
        ]
      },
      fielding: {
        catch: 10,
        stumping: 10,
        runOut: 10
      }
    }
  };
  
  module.exports = pointRules;
  