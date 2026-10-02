/**
 * Calculate typing speed, accuracy, and feedback
 */
export function calculateMetrics(typed, target, durationMs, keystrokesCount = 0) {
  const durationSec = Math.max(durationMs / 1000, 0.1);
  const durationMin = durationSec / 60;
  
  const typedLength = typed.length;
  const targetLength = target.length;
  
  // Characters Per Minute (CPM)
  const cpm = Math.round((typedLength / durationMin) || 0);
  
  // Standard Words Per Minute (WPM) = CPM / 5
  const wpm = Math.round(((typedLength / 5) / durationMin) || 0);

  // Character match comparison
  let correctChars = 0;
  const minLen = Math.min(typedLength, targetLength);
  for (let i = 0; i < minLen; i++) {
    if (typed[i] === target[i]) {
      correctChars++;
    }
  }

  // Calculate error count & accuracy
  let errorCount = 0;
  for (let i = 0; i < minLen; i++) {
    if (typed[i] !== target[i]) {
      errorCount++;
    }
  }
  errorCount += Math.abs(typedLength - targetLength);

  const totalEvaluated = Math.max(targetLength, typedLength, keystrokesCount);
  let accuracy = 0;
  if (totalEvaluated > 0) {
    accuracy = Math.max(0, Math.round(((correctChars / totalEvaluated) * 100) * 10) / 10);
  }
  
  const isPerfect = typed === target;
  if (isPerfect) {
    accuracy = 100;
  }

  return {
    cpm,
    wpm,
    accuracy,
    errorCount,
    durationSec: Number(durationSec.toFixed(2)),
    isSuccess: isPerfect,
  };
}

/**
 * Detailed character-by-character comparison diff
 */
export function computeCharDiff(typed = '', target = '') {
  const diff = [];
  const maxLen = Math.max(typed.length, target.length);

  for (let i = 0; i < maxLen; i++) {
    const tChar = typed[i];
    const targetChar = target[i];

    if (tChar === undefined) {
      // User didn't finish typing
      diff.push({
        status: 'missing',
        expected: targetChar,
        actual: '',
        index: i,
      });
    } else if (targetChar === undefined) {
      // User typed extra characters
      diff.push({
        status: 'extra',
        expected: '',
        actual: tChar,
        index: i,
      });
    } else if (tChar === targetChar) {
      // Exact match
      diff.push({
        status: 'correct',
        expected: targetChar,
        actual: tChar,
        index: i,
      });
    } else {
      // Wrong character
      diff.push({
        status: 'incorrect',
        expected: targetChar,
        actual: tChar,
        index: i,
      });
    }
  }

  return diff;
}

/**
 * Generate human-friendly constructive feedback
 */
export function generateFeedback({ isSuccess, accuracy, wpm, durationSec, timedOut, errorCount, targetLength }) {
  if (timedOut) {
    return {
      title: "Time Expired (30s)",
      badge: "Needs Practice",
      badgeColor: "text-amber-400 bg-amber-400/10 border-amber-400/20",
      description: "You ran out of time before completing this password. Try typing it a few times in count-based mode to commit the pattern to muscle memory.",
      tip: "Focus on finger positioning for non-alphanumeric characters (symbols and numbers)."
    };
  }

  if (isSuccess && accuracy === 100) {
    if (wpm >= 60) {
      return {
        title: "Flawless & Blazing Fast!",
        badge: "Mastered",
        badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        description: `Incredible typing speed at ${wpm} WPM in just ${durationSec}s. Your muscle memory for this password is solid.`,
        tip: "Keep practicing once every few days to maintain long-term retention."
      };
    } else if (wpm >= 35) {
      return {
        title: "Clean & Accurate!",
        badge: "Proficient",
        badgeColor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        description: `100% accuracy achieved in ${durationSec}s (${wpm} WPM). Solid rhythm without any typos.`,
        tip: "Try practicing blind (hidden password) to test pure memory recall."
      };
    } else {
      return {
        title: "Accurate, Ready for Speed!",
        badge: "Accurate",
        badgeColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
        description: `Zero typos! Completed in ${durationSec}s. Your accuracy is spot on, now aim to increase your typing tempo.`,
        tip: "Practice this password 3 to 5 times in succession to accelerate muscle speed."
      };
    }
  }

  if (accuracy >= 80) {
    return {
      title: "Close Match!",
      badge: "Almost There",
      badgeColor: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
      description: `Minor slip-ups (${errorCount} typo${errorCount > 1 ? 's' : ''}). Completed with ${accuracy}% accuracy.`,
      tip: "Inspect the diff highlight above to see which specific key caused the stumble."
    };
  }

  return {
    title: "Needs Repetition",
    badge: "Struggled",
    badgeColor: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    description: `Multiple character mismatches encountered (${errorCount} errors).`,
    tip: "Review the note mnemonic and practice with password revealed before trying blind mode."
  };
}
