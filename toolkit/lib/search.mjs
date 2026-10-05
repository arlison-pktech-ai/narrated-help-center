// Finds what the help says about a question, ready to answer inside the
// product: numbered steps, the link of the tutorial and of its video, close
// frequent questions and glossary words. Pure JavaScript with no imports, so
// the app (a help menu, a command palette) and an assistant tool can use it.
//
//   import * as content from "./content.mjs";
//   const help = createHelpSearch(content, { baseUrl: "help/", language: "en" });
//   help.search({ query: "how do I delete a task?" })   or   help.search({ topic: "edit-task" })
const STOP = {
  en: "how what when where which who why does doing done can could would should will the and for with from into onto about this that these those there here have has had want need make made use using used get got my mine your you yours our please help tutorial video videos step steps show tell explain link app page screen way thing able",
  pt: "como para que uma uns umas onde fica ficam fazer faco faz eu meu minha meus minhas com dos das nos nas por qual quais quero queria preciso posso consigo tem ter esta estao isso esse essa este mais menos mim voce sobre ajuda ajude tutorial tutoriais video videos passo passos link links manda mande mostra mostre explica explique ensina ensine funciona usar uso tela aqui agora pelo pela entao vejo ver",
  es: "como para que una unos unas donde hacer hago hace yo mis con del los las por cual cuales quiero queria necesito puedo tengo esta estan eso ese esa este mas menos sobre ayuda tutorial video videos paso pasos enlace muestra explica ensena funciona usar uso pantalla aqui ahora",
};
const norm = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function createHelpSearch(content, { baseUrl = "help/", language = "en", stopwords = [] } = {}) {
  const stop = new Set([...(STOP[language.split("-")[0]] || STOP.en).split(" "), ...stopwords.map(norm)]);
  const tokens = (text) => norm(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !stop.has(word));
  // Words match on a shared beginning, so "pay", "paid" and "payment" meet.
  const shared = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
  const matches = (word, candidates) => candidates.some((other) => word === other || shared(word, other) >= Math.max(3, Math.min(5, Math.min(word.length, other.length) - 1)));
  const url = (section = "") => `${baseUrl}index.html${section ? `#${section}` : ""}`;
  const videoUrl = (file) => `${baseUrl}video/${file}.mp4`;
  const internal = (text) => String(text).replace(/\]\(#([\w-]+)\)/g, (_, id) => `](${url(id)})`);
  const numbered = (list = []) => list.map((step) => `${step.n}. ${internal(step.text)}`);

  function score(words, fields) {
    let total = 0, found = 0;
    for (const word of words) {
      const best = Math.max(0, ...fields.filter(([text]) => matches(word, text)).map(([, weight]) => weight));
      if (best) { total += best; found++; }
    }
    // A document that answers every word of the question comes first.
    return found === words.length ? total * 1.5 : total;
  }

  const tutorials = content.TUTORIALS || [];
  const guides = [...tutorials];
  if (content.PHONE) guides.push({ id: "phone", title: content.PHONE.title || "Phone", summary: content.PHONE.summary || "", keywords: content.PHONE.keywords || "phone mobile install app", video: content.PHONE.video,
    parts: [...(content.PHONE.install?.length ? [{ blocks: [{ steps: content.PHONE.install.map((text, index) => ({ n: index + 1, text })) }] }] : []), { blocks: content.PHONE.blocks || [] }] });
  for (const screen of content.SCREENS || []) guides.push({ id: "screens", title: screen.name, summary: screen.text, keywords: screen.keywords || "", parts: screen.parts?.length ? [{ blocks: [{ steps: screen.parts.map((text, index) => ({ n: index + 1, text })) }] }] : [] });
  const index = guides.map((guide) => ({ guide, fields: [
    [tokens(guide.title), 5], [tokens(guide.keywords), 4], [tokens(guide.summary), 3], [tokens(guide.parts.map((part) => part.title).join(" ")), 3],
    [tokens([guide.intro, guide.done, ...(guide.before || []), ...(guide.problems || []), ...guide.parts.flatMap((part) => (part.blocks || []).flatMap((block) => [...(block.steps || []), ...(block.extras || [])].map((step) => step.text)))].join(" ")), 1],
  ] }));
  const questions = (content.FAQ || []).flatMap((group) => group.items.map(([question, answer]) => ({ question, answer, fields: [[tokens(question), 4], [tokens(group.title), 2], [tokens(answer), 1]] })));
  const words = (content.GLOSSARY || []).map(([term, meaning]) => ({ term, meaning, fields: [[tokens(term), 4], [tokens(meaning), 1]] }));
  const best = (list, query, limit, floor) => {
    const ranked = list.map((item) => ({ item, value: score(query, item.fields) })).filter((entry) => entry.value >= floor).sort((a, b) => b.value - a.value);
    const top = ranked[0]?.value || 0;
    // Close runners-up only: a weak second match adds noise to the answer.
    return ranked.filter((entry) => entry.value >= top * 0.6).slice(0, limit).map((entry) => entry.item);
  };
  const answer = (guide) => ({
    id: guide.id, title: guide.title, summary: internal(guide.summary || ""), url: url(guide.id),
    video: guide.video ? { title: guide.video.title, url: videoUrl(guide.video.file) } : null,
    ...(guide.before?.length ? { before: guide.before.map(internal) } : {}),
    sections: guide.parts.map((part) => ({
      ...(part.title ? { title: part.title } : {}),
      ...(part.video ? { video: { title: part.video.title, url: videoUrl(part.video.file) } } : {}),
      steps: (part.blocks || []).flatMap((block) => numbered(block.steps)),
      ...((part.blocks || []).some((block) => block.extras?.length) ? { options: part.blocks.flatMap((block) => numbered(block.extras)) } : {}),
    })),
    ...(guide.done ? { done: internal(guide.done) } : {}),
    ...(guide.problems?.length ? { tips: guide.problems.map(internal) } : {}),
  });
  const topics = tutorials.map((guide) => ({ id: guide.id, title: guide.title, url: url(guide.id), video: guide.video ? videoUrl(guide.video.file) : null }));
  const videos = [...tutorials.flatMap((guide) => [guide.video, ...guide.parts.map((part) => part.video)].filter(Boolean).map((video) => ({ ...video, topic: guide.id }))), ...(content.PHONE?.video ? [{ ...content.PHONE.video, topic: "phone" }] : [])]
    .map((video) => ({ file: video.file, title: video.title, topic: video.topic, url: videoUrl(video.file), poster: `${baseUrl}video/${video.file}.jpg` }));

  return {
    topics, videos, url, videoUrl,
    // The known help videos a text links to, in order: an answer may show
    // these players, never a video address it made up.
    videosIn(text = "", limit = 2) {
      const base = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const files = [...String(text).matchAll(new RegExp(`\\]\\(\\s*<?(?:\\./|/)?${base}video/([\\w-]+)\\.mp4\\b`, "g"))].map((match) => match[1]);
      return [...new Set(files)].map((file) => videos.find((video) => video.file === file)).filter(Boolean).slice(0, limit);
    },
    search({ query, topic } = {}) {
      if (topic !== undefined && !guides.some((guide) => guide.id === topic)) throw Error(`topic must be one of: ${topics.map((item) => item.id).join(", ")}`);
      if (!query && !topic) throw Error("Give a query or a topic.");
      const asked = [...new Set(tokens(query))];
      const chosen = topic ? [guides.find((guide) => guide.id === topic)] : best(index, asked, 2, 5).map((entry) => entry.guide);
      // Questions and words need more than one word in common with a long question.
      const floor = Math.max(4, asked.length * 2);
      const faq = asked.length ? best(questions, asked, 3, floor) : [];
      const glossary = asked.length ? best(words, asked, 2, floor) : [];
      const found = [...new Map(chosen.map((guide) => [guide.title, answer(guide)])).values()];
      if (!found.length && !faq.length && !glossary.length) return { found: false, url: url(), topics };
      return {
        found: true, url: url(), tutorials: found,
        ...(faq.length ? { questions: faq.map((item) => ({ question: item.question, answer: internal(item.answer), url: url("faq") })) } : {}),
        ...(glossary.length ? { words: glossary.map((item) => ({ term: item.term, meaning: item.meaning, url: url("glossary") })) } : {}),
      };
    },
  };
}
