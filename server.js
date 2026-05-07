const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// メニュー情報をサーバー側で管理（起動時に読み込む）
let menuData = [
  { name: '日替わり定食', price: '550', ingredients: '米・魚・野菜', allergens: '小麦・魚' },
  { name: '唐揚げ定食',   price: '620', ingredients: '鶏肉・米・野菜', allergens: '小麦・卵・大豆' },
  { name: 'チキンカレー', price: '480', ingredients: '鶏肉・米・カレールー', allergens: '小麦・乳・大豆' },
  { name: '野菜炒め定食', price: '500', ingredients: '野菜各種・豆腐・米', allergens: '大豆' },
  { name: 'ざるそば',     price: '420', ingredients: 'そば・ネギ・わさび', allergens: '小麦・そば' },
];

// ── メニュー取得 ──────────────────────────────────────────────────
app.get('/api/menu', (req, res) => {
  res.json(menuData);
});

// ── メニュー更新（管理画面から） ─────────────────────────────────
app.post('/api/menu', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: '認証エラー' });
  }
  menuData = req.body;
  res.json({ ok: true });
});

// ── AIへの質問 ───────────────────────────────────────────────────
app.post('/api/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: '質問がありません' });

  const menuText = menuData.length === 0
    ? '（メニュー情報が未設定です）'
    : menuData.map((m, i) =>
        `${i + 1}. ${m.name}｜価格: ${m.price}円｜食材: ${m.ingredients}｜アレルギー: ${m.allergens || 'なし'}`
      ).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: `あなたは食堂のスタッフAIです。以下のメニュー情報をもとに、お客様の質問に丁寧かつ簡潔に日本語で答えてください。アレルギーに関する質問には特に正確に答えてください。回答は2〜4文程度に収めてください。

【本日のメニュー情報】
${menuText}`,
        messages: [{ role: 'user', content: question }],
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API error');
    res.json({ answer: data.content[0].text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI応答エラー: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
