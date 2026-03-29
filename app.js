const TARGET_SCORE = 10000;
const EV_T_MAX = 20000;
const CPU_DELAY_MS = 1000;
const CPU_TIMING = {
  beforeSelect: CPU_DELAY_MS,
  perDieSelect: CPU_DELAY_MS,
  afterSelect: CPU_DELAY_MS,
  betweenActions: CPU_DELAY_MS,
  turnSwitch: CPU_DELAY_MS,
};

const targetProbabilities = [
  { target: 500, probability: 57.26 },
  { target: 1000, probability: 34.76 },
  { target: 1500, probability: 18.94 },
  { target: 2000, probability: 10.76 },
  { target: 2500, probability: 6.53 },
  { target: 3000, probability: 3.79 },
  { target: 4000, probability: 1.29 },
];

const state = {
  players: {
    human: 0,
    cpu: 0,
  },
  currentPlayer: "human",
  turnTotal: 0,
  diceRemaining: 6,
  currentRoll: [],
  pendingActions: [],
  selectedMask: 0,
  selectableMask: 0,
  busy: false,
  gameOver: false,
};

const elements = {
  currentPlayer: document.getElementById("current-player"),
  humanScore: document.getElementById("human-score"),
  cpuScore: document.getElementById("cpu-score"),
  turnScore: document.getElementById("turn-score"),
  diceRemaining: document.getElementById("dice-remaining"),
  rollPotential: document.getElementById("roll-potential"),
  diceTray: document.getElementById("dice-tray"),
  actionsList: document.getElementById("actions-list"),
  statusPill: document.getElementById("status-pill"),
  evRecommendation: document.getElementById("ev-recommendation"),
  evExplainer: document.getElementById("ev-explainer"),
  pressingRecommendation: document.getElementById("pressing-recommendation"),
  optimalAction: document.getElementById("optimal-action"),
  optimalActionEv: document.getElementById("optimal-action-ev"),
  rollBtn: document.getElementById("roll-btn"),
  keepBtn: document.getElementById("keep-btn"),
  bankBtn: document.getElementById("bank-btn"),
  resetBtn: document.getElementById("reset-btn"),
  advisorYourScore: document.getElementById("advisor-your-score"),
  advisorOpponentScore: document.getElementById("advisor-opponent-score"),
  advisorTargetScore: document.getElementById("advisor-target-score"),
  advisorTurnTotal: document.getElementById("advisor-turn-total"),
  advisorDiceRemaining: document.getElementById("advisor-dice-remaining"),
  advisorOpponentsLastTurn: document.getElementById("advisor-opponents-last-turn"),
  advisorRecommendation: document.getElementById("advisor-recommendation"),
  advisorDetails: document.getElementById("advisor-details"),
};

const evEngine = {
  ready: false,
  v: Array.from({ length: 7 }, () => []),
  roll: Array.from({ length: 7 }, () => []),
  profiles: Array.from({ length: 7 }, () => []),
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDieValue() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollDice(count) {
  return Array.from({ length: count }, randomDieValue);
}

function popcount(mask) {
  let value = mask;
  let count = 0;
  while (value) {
    count += value & 1;
    value >>= 1;
  }
  return count;
}

function sortedKeptValues(roll, mask) {
  const kept = [];
  for (let index = 0; index < roll.length; index += 1) {
    if (mask & (1 << index)) {
      kept.push(roll[index]);
    }
  }
  kept.sort((a, b) => a - b);
  return kept;
}

function countsFromValues(values) {
  const counts = Array(7).fill(0);
  values.forEach((value) => {
    counts[value] += 1;
  });
  return counts;
}

function isStraight(counts) {
  for (let value = 1; value <= 6; value += 1) {
    if (counts[value] !== 1) {
      return false;
    }
  }
  return true;
}

function isThreePairs(counts) {
  let pairs = 0;
  for (let value = 1; value <= 6; value += 1) {
    if (counts[value] === 2) {
      pairs += 1;
    }
  }
  return pairs === 3;
}

function isFourPlusPair(counts) {
  let hasFour = false;
  let hasPair = false;
  for (let value = 1; value <= 6; value += 1) {
    if (counts[value] === 4) {
      hasFour = true;
    }
    if (counts[value] === 2) {
      hasPair = true;
    }
  }
  return hasFour && hasPair;
}

function isTwoTriplets(counts) {
  let triplets = 0;
  for (let value = 1; value <= 6; value += 1) {
    if (counts[value] === 3) {
      triplets += 1;
    }
  }
  return triplets === 2;
}

function scoreCountsExact(counts) {
  const memo = new Map();

  function recurse(localCounts) {
    const key = localCounts.slice(1).join(",");
    if (memo.has(key)) {
      return memo.get(key);
    }

    const remaining = localCounts.slice(1).reduce((sum, count) => sum + count, 0);
    if (remaining === 0) {
      return 0;
    }

    let best = -Infinity;

    if (remaining === 6) {
      if (isStraight(localCounts)) {
        best = Math.max(best, 1500);
      }
      if (isThreePairs(localCounts)) {
        best = Math.max(best, 1500);
      }
      if (isFourPlusPair(localCounts)) {
        best = Math.max(best, 1500);
      }
      if (isTwoTriplets(localCounts)) {
        best = Math.max(best, 2500);
      }
    }

    for (let value = 1; value <= 6; value += 1) {
      if (localCounts[value] >= 6) {
        const next = localCounts.slice();
        next[value] -= 6;
        best = Math.max(best, 3000 + recurse(next));
      }
      if (localCounts[value] >= 5) {
        const next = localCounts.slice();
        next[value] -= 5;
        best = Math.max(best, 2000 + recurse(next));
      }
      if (localCounts[value] >= 4) {
        const next = localCounts.slice();
        next[value] -= 4;
        best = Math.max(best, 1000 + recurse(next));
      }
      if (localCounts[value] >= 3) {
        const next = localCounts.slice();
        next[value] -= 3;
        const tripleScore = value === 1 ? 1000 : value * 100;
        best = Math.max(best, tripleScore + recurse(next));
      }
    }

    if (localCounts[1] > 0) {
      const next = localCounts.slice();
      next[1] -= 1;
      best = Math.max(best, 100 + recurse(next));
    }

    if (localCounts[5] > 0) {
      const next = localCounts.slice();
      next[5] -= 1;
      best = Math.max(best, 50 + recurse(next));
    }

    memo.set(key, best);
    return best;
  }

  const score = recurse(counts.slice());
  return Number.isFinite(score) && score > 0 ? score : 0;
}

function enumerateLegalActions(rollValues) {
  const n = rollValues.length;
  const actions = [];
  const seen = new Set();

  for (let mask = 1; mask < 1 << n; mask += 1) {
    const chosen = [];
    for (let index = 0; index < n; index += 1) {
      if (mask & (1 << index)) {
        chosen.push(rollValues[index]);
      }
    }

    const score = scoreCountsExact(countsFromValues(chosen));
    if (score <= 0) {
      continue;
    }

    const usedDice = popcount(mask);
    const nextDice = usedDice === n ? 6 : n - usedDice;
    const signature = `${mask}:${score}`;

    if (!seen.has(signature)) {
      seen.add(signature);
      actions.push({
        mask,
        score,
        usedDice,
        nextDice,
        keptValues: sortedKeptValues(rollValues, mask),
      });
    }
  }

  actions.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.nextDice - a.nextDice;
  });

  return actions;
}

function isMaskLegal(mask, actions) {
  return actions.some((action) => action.mask === mask);
}

function computeSelectableMask(selectedMask, actions, diceCount) {
  let selectable = 0;
  for (let index = 0; index < diceCount; index += 1) {
    const bit = 1 << index;
    if (selectedMask & bit) {
      selectable |= bit;
      continue;
    }

    const nextMask = selectedMask | bit;
    const canContinue = actions.some((action) => (action.mask & nextMask) === nextMask);
    if (canContinue) {
      selectable |= bit;
    }
  }
  return selectable;
}

function setStatus(text) {
  elements.statusPill.textContent = text;
}

function getCurrentPlayerLabel() {
  return state.currentPlayer === "human" ? "You" : "CPU";
}

function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i += 1) {
    result *= i;
  }
  return result;
}

function expandCountsToRoll(counts) {
  const roll = [];
  for (let face = 1; face <= 6; face += 1) {
    for (let c = 0; c < counts[face]; c += 1) {
      roll.push(face);
    }
  }
  return roll;
}

function generateCountProfiles(n) {
  const result = [];

  function dfs(face, remaining, counts) {
    if (face === 6) {
      counts[6] = remaining;
      result.push(counts.slice());
      return;
    }

    for (let count = 0; count <= remaining; count += 1) {
      counts[face] = count;
      dfs(face + 1, remaining - count, counts);
    }
  }

  dfs(1, n, Array(7).fill(0));
  return result;
}

function multinomialProbability(counts, n) {
  let numerator = factorial(n);
  for (let face = 1; face <= 6; face += 1) {
    numerator /= factorial(counts[face]);
  }
  return numerator / 6 ** n;
}

function buildRollProfiles() {
  for (let n = 1; n <= 6; n += 1) {
    const profiles = [];
    const countProfiles = generateCountProfiles(n);

    for (const counts of countProfiles) {
      const roll = expandCountsToRoll(counts);
      const legal = enumerateLegalActions(roll);
      const actionSet = new Set();
      const reducedActions = [];

      for (const action of legal) {
        const key = `${action.score}:${action.nextDice}`;
        if (!actionSet.has(key)) {
          actionSet.add(key);
          reducedActions.push({ score: action.score, nextDice: action.nextDice });
        }
      }

      profiles.push({
        probability: multinomialProbability(counts, n),
        actions: reducedActions,
      });
    }

    evEngine.profiles[n] = profiles;
  }
}

function getTurnValue(n, t) {
  if (!evEngine.ready) {
    return t;
  }
  if (t >= EV_T_MAX) {
    return t;
  }
  return evEngine.v[n][t];
}

function getRollValue(n, t) {
  if (!evEngine.ready) {
    return 0;
  }
  if (t >= EV_T_MAX) {
    return t;
  }
  return evEngine.roll[n][t];
}

function buildExactEVTables() {
  buildRollProfiles();

  for (let n = 1; n <= 6; n += 1) {
    evEngine.v[n] = Array(EV_T_MAX + 1).fill(0);
    evEngine.roll[n] = Array(EV_T_MAX + 1).fill(0);
  }

  for (let t = EV_T_MAX; t >= 0; t -= 1) {
    for (let n = 1; n <= 6; n += 1) {
      let rollAgain = 0;

      for (const profile of evEngine.profiles[n]) {
        if (profile.actions.length === 0) {
          continue;
        }

        let best = -Infinity;
        for (const action of profile.actions) {
          const future = getTurnValue(action.nextDice, t + action.score);
          if (future > best) {
            best = future;
          }
        }

        rollAgain += profile.probability * best;
      }

      evEngine.roll[n][t] = rollAgain;
      evEngine.v[n][t] = Math.max(t, rollAgain);
    }
  }

  evEngine.ready = true;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function computeStateRecommendation({
  yourScore,
  opponentScore,
  targetScore,
  turnTotal,
  diceRemaining,
  opponentsGetLastTurn,
}) {
  const rollEV = getRollValue(diceRemaining, turnTotal);
  const bankEV = turnTotal;
  const bankedScore = yourScore + turnTotal;

  let action = rollEV > bankEV ? "ROLL" : "BANK";
  let rationale =
    action === "ROLL"
      ? "Pure EV favors continuing this turn."
      : "Pure EV favors locking in points now.";

  if (bankedScore >= targetScore) {
    action = "BANK";
    rationale = opponentsGetLastTurn
      ? "Banking reaches target now. Even with a final reply turn, this is the standard play."
      : "Banking reaches target and ends the game immediately.";
  } else if (opponentScore >= targetScore && bankedScore < opponentScore) {
    action = "ROLL";
    rationale = "Opponent has already reached target, so you must press for a bigger turn.";
  } else if (opponentScore >= targetScore - 600 && bankedScore < opponentScore - 700 && turnTotal < 1400) {
    action = "ROLL";
    rationale =
      "You are in late-game catch-up mode. Pressing improves comeback chances versus small banks.";
  }

  return {
    action,
    rationale,
    rollEV,
    bankEV,
    bankedScore,
  };
}

function runAdvisor() {
  if (!evEngine.ready) {
    elements.advisorRecommendation.textContent = "EV engine is still loading. Try again in a moment.";
    elements.advisorDetails.textContent = "Roll EV: -, Bank EV: -";
    return;
  }

  const yourScore = toNonNegativeInt(elements.advisorYourScore.value, 0);
  const opponentScore = toNonNegativeInt(elements.advisorOpponentScore.value, 0);
  const targetScore = clamp(toNonNegativeInt(elements.advisorTargetScore.value, TARGET_SCORE), 1000, 50000);
  const turnTotal = toNonNegativeInt(elements.advisorTurnTotal.value, 0);
  const diceRemaining = clamp(toNonNegativeInt(elements.advisorDiceRemaining.value, 6), 1, 6);
  const opponentsGetLastTurn = Boolean(elements.advisorOpponentsLastTurn.checked);

  const recommendation = computeStateRecommendation({
    yourScore,
    opponentScore,
    targetScore,
    turnTotal,
    diceRemaining,
    opponentsGetLastTurn,
  });

  elements.advisorRecommendation.innerHTML =
    `Recommended action: <strong>${recommendation.action}</strong>. ${recommendation.rationale}`;

  elements.advisorDetails.textContent =
    `Roll EV: ${recommendation.rollEV.toFixed(2)} | Bank EV: ${recommendation.bankEV.toFixed(2)} | ` +
    `Score if banked now: ${recommendation.bankedScore}`;
}

function findBestTargetRow(turnTotal) {
  let best = targetProbabilities[0].target;
  for (const item of targetProbabilities) {
    if (item.target <= turnTotal) {
      best = item.target;
    }
  }
  return best;
}

function shouldPressBecauseBehind() {
  const me = state.currentPlayer === "human" ? state.players.human : state.players.cpu;
  const them = state.currentPlayer === "human" ? state.players.cpu : state.players.human;
  const banked = me + state.turnTotal;
  return them >= 9000 && banked < them - 1000;
}

function getContinuationPlan(playerKey, turnTotal, diceRemaining) {
  if (state.players[playerKey] + turnTotal >= TARGET_SCORE) {
    return {
      action: "BANK",
      value: turnTotal,
      winsGame: true,
    };
  }

  const rollValue = getRollValue(diceRemaining, turnTotal);
  if (rollValue > turnTotal) {
    return {
      action: "ROLL",
      value: rollValue,
      winsGame: false,
    };
  }

  return {
    action: "BANK",
    value: turnTotal,
    winsGame: false,
  };
}

function pickBestAction(actions, playerKey = state.currentPlayer) {
  let best = null;
  let bestPlan = null;
  let bestValue = -Infinity;

  for (const action of actions) {
    const plan = getContinuationPlan(playerKey, state.turnTotal + action.score, action.nextDice);
    const value = plan.winsGame ? Number.POSITIVE_INFINITY : plan.value;

    if (value > bestValue) {
      bestValue = value;
      best = action;
      bestPlan = plan;
    }
  }

  return { best, bestValue, bestPlan };
}

function renderDice() {
  elements.diceTray.innerHTML = "";
  if (state.currentRoll.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "hint";
    placeholder.textContent = "No active roll yet.";
    elements.diceTray.appendChild(placeholder);
    return;
  }

  for (let index = 0; index < state.currentRoll.length; index += 1) {
    const value = state.currentRoll[index];
    const bit = 1 << index;
    const die = document.createElement("button");
    die.className = "die";
    die.type = "button";
    die.textContent = String(value);
    die.setAttribute("aria-label", `Die ${index + 1}: ${value}`);

    const selected = (state.selectedMask & bit) !== 0;
    const selectable = (state.selectableMask & bit) !== 0;

    if (selected) {
      die.classList.add("die-selected");
    }
    if (!selectable) {
      die.classList.add("die-blocked");
    }
    if (state.currentPlayer === "cpu") {
      die.classList.add("die-cpu-turn");
    }

    die.disabled = state.busy || state.currentPlayer !== "human" || !selectable;
    die.addEventListener("click", () => onDieClick(index));
    elements.diceTray.appendChild(die);
  }
}

function renderActions() {
  elements.actionsList.innerHTML = "";

  if (state.pendingActions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Roll to reveal legal choices.";
    elements.actionsList.appendChild(empty);
    return;
  }

  const seenText = new Set();
  for (const action of state.pendingActions) {
    const entry = document.createElement("p");
    entry.className = "action-item";
    const text = `[${action.keptValues.join(", ")}] -> +${action.score}, next ${action.nextDice} dice`;
    if (seenText.has(text)) {
      continue;
    }
    seenText.add(text);
    entry.textContent = text;
    if (action.mask === state.selectedMask) {
      entry.classList.add("action-item-active");
    }
    elements.actionsList.appendChild(entry);
  }
}

function highlightActiveRows() {
  document.querySelectorAll("[data-ev-row]").forEach((row) => {
    row.classList.remove("row-active");
  });
  document.querySelectorAll("[data-target-row]").forEach((row) => {
    row.classList.remove("row-active");
  });

  const evRow = document.querySelector(`[data-ev-row=\"${state.diceRemaining}\"]`);
  if (evRow) {
    evRow.classList.add("row-active");
  }

  const targetRow = findBestTargetRow(state.turnTotal);
  const pressingRow = document.querySelector(`[data-target-row=\"${targetRow}\"]`);
  if (pressingRow) {
    pressingRow.classList.add("row-active");
  }
}

function renderRecommendation() {
  const rollEV = getRollValue(state.diceRemaining, state.turnTotal);
  const bankEV = state.turnTotal;
  const recommendRoll = rollEV > bankEV;

  if (recommendRoll) {
    elements.evRecommendation.innerHTML = `Pure EV: <strong>ROLL</strong>. Rolling is worth about ${rollEV.toFixed(2)} vs banking ${bankEV.toFixed(2)}.`;
  } else {
    elements.evRecommendation.innerHTML = `Pure EV: <strong>BANK</strong>. Banking ${bankEV.toFixed(2)} beats rolling at about ${rollEV.toFixed(2)}.`;
  }

  if (state.diceRemaining === 6) {
    elements.evExplainer.textContent = `With 6 dice, farkles are rare, so roll EV usually dominates bank EV even at high turn totals. For the following unbanked turn totals:`;
  } else {
    elements.evExplainer.textContent = `This compares expected turn value if you bank now versus continue rolling from ${state.diceRemaining} dice.`;
  }

  if (shouldPressBecauseBehind()) {
    elements.pressingRecommendation.textContent = "You are far behind in late game: target-based pressing applies, so keep pushing for a bigger turn.";
  } else {
    elements.pressingRecommendation.textContent = "No urgent comeback pressure. Pure-EV thresholds are a reasonable baseline.";
  }
}

function renderOptimalAction() {
  if (state.pendingActions.length === 0) {
    const plan = getContinuationPlan(state.currentPlayer, state.turnTotal, state.diceRemaining);
    const rollEV = getRollValue(state.diceRemaining, state.turnTotal);
    const bankEV = state.turnTotal;

    elements.optimalAction.innerHTML = `Best action is <strong>${plan.action}</strong>.`;

    if (plan.winsGame) {
      elements.optimalActionEv.textContent = `Banking now reaches ${TARGET_SCORE} and wins immediately.`;
      return;
    }

    elements.optimalActionEv.textContent = `EV now: roll ${rollEV.toFixed(2)} vs bank ${bankEV.toFixed(2)}.`;
    return;
  }

  const { best, bestValue, bestPlan } = pickBestAction(state.pendingActions);

  if (bestPlan.winsGame) {
    elements.optimalAction.textContent = `Best current keep: [${best.keptValues.join(", ")}] for +${best.score}, then bank to win.`;
    elements.optimalActionEv.textContent = `This keep reaches ${TARGET_SCORE} or better immediately.`;
    return;
  }

  elements.optimalAction.textContent = `Best current keep: [${best.keptValues.join(", ")}] for +${best.score}, then ${best.nextDice} dice.`;
  elements.optimalActionEv.textContent = `Exact full-turn EV after this keep: ${bestValue.toFixed(2)} points.`;
}

function render() {
  elements.currentPlayer.textContent = getCurrentPlayerLabel();
  elements.humanScore.textContent = String(state.players.human);
  elements.cpuScore.textContent = String(state.players.cpu);
  elements.turnScore.textContent = String(state.turnTotal);
  elements.diceRemaining.textContent = String(state.diceRemaining);

  if (state.pendingActions.length > 0) {
    const bestScore = Math.max(...state.pendingActions.map((action) => action.score));
    elements.rollPotential.textContent = String(bestScore);
  } else {
    elements.rollPotential.textContent = "-";
  }

  renderDice();
  renderActions();
  renderRecommendation();
  renderOptimalAction();
  highlightActiveRows();

  const legalSelection = isMaskLegal(state.selectedMask, state.pendingActions);
  const canHumanAct = !state.busy && state.currentPlayer === "human" && !state.gameOver;

  elements.rollBtn.disabled = !canHumanAct || state.pendingActions.length > 0;
  elements.keepBtn.disabled = !canHumanAct || !legalSelection;
  elements.bankBtn.disabled = !canHumanAct || state.pendingActions.length > 0 || state.turnTotal === 0;
  elements.resetBtn.disabled = state.busy;
}

async function animateRollAndResolve() {
  state.busy = true;
  state.pendingActions = [];
  state.selectedMask = 0;
  state.selectableMask = 0;

  const start = Date.now();
  while (Date.now() - start < 650) {
    state.currentRoll = rollDice(state.diceRemaining);
    render();
    await delay(85);
  }

  state.currentRoll = rollDice(state.diceRemaining);
  state.pendingActions = enumerateLegalActions(state.currentRoll);

  if (state.pendingActions.length === 0) {
    setStatus(`${getCurrentPlayerLabel()} farkled on ${state.currentRoll.join(", ")}. Turn ends at 0.`);
    await delay(850);
    await endTurnWithoutBank();
    return;
  }

  state.selectedMask = 0;
  state.selectableMask = computeSelectableMask(0, state.pendingActions, state.currentRoll.length);
  setStatus(`${getCurrentPlayerLabel()} rolled ${state.currentRoll.join(", ")}. Select dice to keep.`);
  state.busy = false;
  render();

  if (state.currentPlayer === "cpu") {
    await delay(CPU_TIMING.beforeSelect);
    await cpuSelectAndKeep();
  }
}

function applyAction(action) {
  state.turnTotal += action.score;
  state.diceRemaining = action.nextDice;
  const hotDice = action.usedDice === state.currentRoll.length;

  state.currentRoll = [];
  state.pendingActions = [];
  state.selectedMask = 0;
  state.selectableMask = 0;

  if (hotDice) {
    setStatus(`${getCurrentPlayerLabel()} kept [${action.keptValues.join(", ")}] for +${action.score}. Hot dice, back to 6.`);
  } else {
    setStatus(`${getCurrentPlayerLabel()} kept [${action.keptValues.join(", ")}] for +${action.score}.`);
  }

  render();
}

async function cpuSelectAndKeep() {
  const { best } = pickBestAction(state.pendingActions, "cpu");
  const pickOrder = [];

  for (let index = 0; index < state.currentRoll.length; index += 1) {
    if (best.mask & (1 << index)) {
      pickOrder.push(index);
    }
  }

  state.busy = true;
  for (const dieIndex of pickOrder) {
    state.selectedMask |= 1 << dieIndex;
    state.selectableMask = computeSelectableMask(
      state.selectedMask,
      state.pendingActions,
      state.currentRoll.length
    );
    setStatus(`CPU selecting die ${dieIndex + 1}...`);
    render();
    await delay(CPU_TIMING.perDieSelect);
  }

  await delay(CPU_TIMING.afterSelect);
  applyAction(best);
  state.busy = false;
  render();

  await delay(CPU_TIMING.betweenActions);
  await cpuContinueTurn();
}

async function cpuContinueTurn() {
  const plan = getContinuationPlan("cpu", state.turnTotal, state.diceRemaining);

  if (plan.action === "BANK") {
    await bankTurn();
    return;
  }

  await animateRollAndResolve();
}

function onDieClick(index) {
  if (state.busy || state.currentPlayer !== "human") {
    return;
  }

  const bit = 1 << index;
  const selectable = (state.selectableMask & bit) !== 0;
  if (!selectable) {
    return;
  }

  if (state.selectedMask & bit) {
    state.selectedMask &= ~bit;
  } else {
    state.selectedMask |= bit;
  }

  state.selectableMask = computeSelectableMask(
    state.selectedMask,
    state.pendingActions,
    state.currentRoll.length
  );
  render();
}

function resetTurnState() {
  state.turnTotal = 0;
  state.diceRemaining = 6;
  state.currentRoll = [];
  state.pendingActions = [];
  state.selectedMask = 0;
  state.selectableMask = 0;
}

function isWinningState(playerKey) {
  return state.players[playerKey] >= TARGET_SCORE;
}

function finishGame(winnerKey) {
  state.gameOver = true;
  state.busy = false;
  const winner = winnerKey === "human" ? "You" : "CPU";
  setStatus(`${winner} reached ${TARGET_SCORE}. Match over.`);
  render();
}

async function endTurnWithoutBank() {
  resetTurnState();
  state.currentPlayer = state.currentPlayer === "human" ? "cpu" : "human";
  render();

  if (!state.gameOver && state.currentPlayer === "cpu") {
    await delay(CPU_TIMING.turnSwitch);
    await animateRollAndResolve();
  } else {
    state.busy = false;
    setStatus("Your turn.");
    render();
  }
}

async function bankTurn() {
  const playerKey = state.currentPlayer;
  state.players[playerKey] += state.turnTotal;
  const bankedValue = state.turnTotal;

  if (isWinningState(playerKey)) {
    finishGame(playerKey);
    return;
  }

  resetTurnState();
  state.currentPlayer = state.currentPlayer === "human" ? "cpu" : "human";
  setStatus(`${playerKey === "human" ? "You" : "CPU"} banked ${bankedValue}. Turn switches.`);
  render();

  if (state.currentPlayer === "cpu") {
    await delay(CPU_TIMING.turnSwitch);
    await animateRollAndResolve();
  } else {
    state.busy = false;
    setStatus("Your turn. Roll or bank strategy applies after each keep.");
    render();
  }
}

async function onRollClick() {
  if (state.busy || state.gameOver || state.currentPlayer !== "human" || state.pendingActions.length > 0) {
    return;
  }
  await animateRollAndResolve();
}

function onKeepClick() {
  if (state.busy || state.currentPlayer !== "human") {
    return;
  }
  const chosen = state.pendingActions.find((action) => action.mask === state.selectedMask);
  if (!chosen) {
    return;
  }
  applyAction(chosen);
}

async function onBankClick() {
  if (state.busy || state.currentPlayer !== "human" || state.pendingActions.length > 0 || state.turnTotal === 0) {
    return;
  }
  await bankTurn();
}

function onResetMatch() {
  if (state.busy) {
    return;
  }
  state.players.human = 0;
  state.players.cpu = 0;
  resetTurnState();
  state.currentPlayer = "human";
  state.gameOver = false;
  setStatus("Match reset. Your turn.");
  render();
}

function initialize() {
  state.busy = true;
  setStatus("Building exact EV engine...");
  render();

  setTimeout(() => {
    buildExactEVTables();
    state.busy = false;
    setStatus("Exact EV engine ready. Your turn.");
    render();
    runAdvisor();
  }, 0);
}

elements.rollBtn.addEventListener("click", onRollClick);
elements.keepBtn.addEventListener("click", onKeepClick);
elements.bankBtn.addEventListener("click", onBankClick);
elements.resetBtn.addEventListener("click", onResetMatch);

[
  elements.advisorYourScore,
  elements.advisorOpponentScore,
  elements.advisorTargetScore,
  elements.advisorTurnTotal,
  elements.advisorDiceRemaining,
  elements.advisorOpponentsLastTurn,
].forEach((input) => {
  input.addEventListener("input", runAdvisor);
  input.addEventListener("change", runAdvisor);
});

initialize();
