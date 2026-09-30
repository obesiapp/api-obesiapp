'use strict';
const db = require('../config/db');
const MAX_LEVEL = 50;
const pointsForLevel = n => n <= 10 ? 50 : n <= 20 ? 75 : n <= 30 ? 100 : n <= 40 ? 150 : 200;
const invalid = message => Object.assign(new Error(message), { status: 400 });

const getProgress = async childId => {
  const { rows } = await db.query(
    `SELECT level FROM healthkids.quiz_attempts
     WHERE child_id = $1 AND percentage >= 80 AND level IS NOT NULL
     GROUP BY level ORDER BY level`, [childId]);

  const completedLevels = rows.map(r => Number(r.level));

  let nextLevel = 1;

  while (completedLevels.includes(nextLevel) && nextLevel <= MAX_LEVEL) nextLevel++;
  return {
    completedLevels,
    levels: Array.from({ length: MAX_LEVEL }, (_, i) => ({
      id: `nivel-${i + 1}`, levelNumber: i + 1, title: `Nivel ${i + 1}`,
      description: 'Responde preguntas sobre hábitos saludables.',
      points: pointsForLevel(i + 1),
      status: completedLevels.includes(i + 1) ? 'completed' : i + 1 === nextLevel ? 'unlocked' : 'locked'
    })),
    trophies: [
      { level: 10, title: 'Explorador Saludable', icon: '🌟' },
      { level: 25, title: 'Héroe de la Nutrición', icon: '🦸' },
      { level: 50, title: 'Maestro de Hábitos', icon: '👑' }
    ].map(t => ({ ...t, unlocked: nextLevel > t.level }))
  };
};

const checkLevel = async (childId, level) => {
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw invalid('Nivel inválido');
  const progress = await getProgress(childId);
  if (progress.levels[level - 1].status === 'locked') throw invalid('Completa primero el nivel anterior');
};

const saveResult = async (childId, result) => {
  const { level, score, totalQuestions, topic } = result;
  if (!Number.isInteger(score) || !Number.isInteger(totalQuestions) || totalQuestions < 1 ||
    totalQuestions > 50 || score < 0 || score > totalQuestions ||
    typeof topic !== 'string' || !topic.trim() || topic.length > 100) throw invalid('Resultado inválido');
  await checkLevel(childId, level);

  const percentage = score / totalQuestions * 100;
  return db.withTransaction(async client => {
    // Serializa premios del mismo niño para no duplicar XP al repetir un nivel.
    await client.query('SELECT child_id FROM healthkids.child_profiles WHERE child_id = $1 FOR UPDATE', [childId]);

    const previous = await client.query(
      'SELECT 1 FROM healthkids.quiz_attempts WHERE child_id = $1 AND level = $2 AND percentage >= 80 LIMIT 1',
      [childId, level]);

    const passed = percentage >= 80;

    const base = pointsForLevel(level);

    const xpEarned = previous.rowCount ? 0 : passed ? base + (percentage === 100 ? Math.round(base * .2) : 0) : 10;

    const { rows } = await client.query(
      `INSERT INTO healthkids.quiz_attempts
       (child_id, topic, difficulty, level, score, total_questions, percentage, xp_earned)
       VALUES ($1,$2,'dynamic',$3,$4,$5,$6,$7) RETURNING *`,
      [childId, topic, level, score, totalQuestions, percentage, xpEarned]);
    await client.query('UPDATE healthkids.child_profiles SET current_xp = current_xp + $1 WHERE child_id = $2', [xpEarned, childId]);
    return { ...rows[0], passed, xpEarned };
  });
};

module.exports = { getProgress, checkLevel, saveResult };
