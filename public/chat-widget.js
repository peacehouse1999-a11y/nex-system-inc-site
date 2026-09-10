// Assistant virtuel Nex System — chatbot FAQ + aide au formulaire de contact
// Aucune clé API requise : réponses pré-écrites + logique conversationnelle simple.
// Réutilise l'endpoint existant POST /api/contact pour envoyer les demandes.

(function () {
  // ---------- Données FAQ ----------
  const FAQ = [
    {
      keywords: ['service', 'offre', 'propose', 'faites', 'quoi'],
      answer: "Nous sommes spécialisés dans la <strong>création et l'optimisation de votre profil Google</strong> (Google Maps), avec un suivi mensuel pour faire grandir votre visibilité dans la durée. Nous proposons aussi une <strong>Formation</strong> pour ceux qui préfèrent apprendre à le faire eux-mêmes.",
    },
    {
      keywords: ['prix', 'tarif', 'coût', 'cout', 'combien', 'pack', 'forfait'],
      answer: "Nous avons 3 packs : <strong>Startup</strong> (150€, 1 mois de suivi inclus, puis 99€/mois), <strong>Business</strong> (250€, 3 mois inclus, puis 149€/mois), et <strong>Premium</strong> (500€, 6 mois inclus, puis 399€/mois). Aucun engagement à long terme.",
    },
    {
      keywords: ['formation', 'coaching', 'apprendre', 'atelier'],
      answer: "Nos formations pratiques vous apprennent à utiliser les outils IA et créatifs pour gagner en autonomie numérique — sans jargon technique inutile.",
    },
    {
      keywords: ['propos', 'qui êtes', 'qui etes', 'entreprise', 'experience', 'expérience'],
      answer: "Nex System Inc. accompagne depuis plus de 3 ans des TPE, PME, travailleurs autonomes et artistes qui veulent être visibles et autonomes, sans dépendre indéfiniment d'une agence.",
    },
    {
      keywords: ['langue', 'anglais', 'allemand', 'francais', 'français', 'multilingue'],
      answer: "Nous offrons nos services en français, anglais et allemand.",
    },
    {
      keywords: ['google maps', 'référencement', 'referencement', 'seo', 'local'],
      answer: "Le référencement local optimise votre fiche Google Maps pour apparaître devant les bonnes personnes, au bon moment — plus de vues, plus d'appels, plus d'itinéraires vers votre commerce.",
    },
  ];

  const BESOIN_LABELS = {
    seo: 'Référencement Local & Google Maps',
    formation: 'Formation / Coaching',
    autre: 'Autre',
  };

  const QUICK_REPLIES_MAIN = [
    { label: 'Nos services', value: 'services' },
    { label: 'Formations', value: 'formations' },
    { label: 'Parler à un humain', value: 'contact' },
  ];

  function normalize(str) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function findFaqAnswer(text) {
    const n = normalize(text);
    for (const entry of FAQ) {
      if (entry.keywords.some((k) => n.includes(normalize(k)))) {
        return entry.answer;
      }
    }
    return null;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // ---------- État de la conversation ----------
  let state = { mode: 'idle', data: {} };

  // ---------- Construction de l'interface ----------
  const style = document.createElement('style');
  style.textContent = `
    #nx-chat-btn{position:fixed;bottom:22px;right:22px;z-index:9999;width:58px;height:58px;border-radius:9999px;
      background:linear-gradient(135deg,#3B82F6,#8B5CF6);border:none;cursor:pointer;
      box-shadow:0 10px 30px -8px rgba(59,130,246,0.6);display:flex;align-items:center;justify-content:center;
      transition:transform .25s ease;}
    #nx-chat-btn:hover{transform:translateY(-3px) scale(1.05);}
    #nx-chat-btn svg{width:26px;height:26px;color:#fff;}
    #nx-chat-panel{position:fixed;bottom:92px;right:22px;z-index:9999;width:340px;max-width:92vw;height:480px;
      max-height:75vh;display:none;flex-direction:column;border-radius:20px;overflow:hidden;
      background:linear-gradient(180deg, rgba(30,41,59,0.97), rgba(15,23,42,0.98));
      border:1px solid rgba(148,163,184,0.15);box-shadow:0 25px 60px -15px rgba(0,0,0,0.6);
      font-family:'Plus Jakarta Sans', sans-serif;}
    #nx-chat-panel.open{display:flex;}
    #nx-chat-head{padding:14px 16px;background:linear-gradient(90deg,#3B82F6,#8B5CF6);display:flex;
      align-items:center;justify-content:space-between;}
    #nx-chat-head span{color:#fff;font-weight:700;font-family:'Space Grotesk',sans-serif;font-size:14px;}
    #nx-chat-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:4px;}
    #nx-chat-body{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
    .nx-msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;}
    .nx-msg.bot{align-self:flex-start;background:rgba(148,163,184,0.15);color:#E5EAF2;border-bottom-left-radius:4px;}
    .nx-msg.user{align-self:flex-end;background:linear-gradient(90deg,#3B82F6,#8B5CF6);color:#fff;border-bottom-right-radius:4px;}
    #nx-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;}
    .nx-chip{background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.4);color:#C4B5FD;
      font-size:12px;padding:6px 10px;border-radius:999px;cursor:pointer;transition:all .2s ease;}
    .nx-chip:hover{background:rgba(139,92,246,0.25);}
    #nx-chat-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(148,163,184,0.15);}
    #nx-chat-input{flex:1;background:rgba(15,23,42,0.6);border:1px solid rgba(148,163,184,0.25);
      border-radius:10px;padding:9px 12px;color:#E5EAF2;font-size:13px;outline:none;}
    #nx-chat-input:focus{border-color:#8B5CF6;}
    #nx-chat-send{background:linear-gradient(90deg,#3B82F6,#8B5CF6);border:none;color:#fff;border-radius:10px;
      padding:0 14px;cursor:pointer;font-size:13px;font-weight:600;}
  `;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'nx-chat-btn';
  btn.setAttribute('aria-label', 'Ouvrir l\'assistant');
  btn.innerHTML = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.08-.152-3.02-.433L3 21l1.5-4.5C3.55 15.163 3 13.63 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>';
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'nx-chat-panel';
  panel.innerHTML = `
    <div id="nx-chat-head">
      <span>Assistant Nex System</span>
      <button id="nx-chat-close" aria-label="Fermer">✕</button>
    </div>
    <div id="nx-chat-body"></div>
    <div id="nx-quick"></div>
    <form id="nx-chat-form">
      <input id="nx-chat-input" type="text" placeholder="Écrivez votre message…" autocomplete="off" />
      <button id="nx-chat-send" type="submit">Envoyer</button>
    </form>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector('#nx-chat-body');
  const quick = panel.querySelector('#nx-quick');
  const form = panel.querySelector('#nx-chat-form');
  const input = panel.querySelector('#nx-chat-input');

  function addMsg(text, who) {
    const div = document.createElement('div');
    div.className = 'nx-msg ' + who;
    div.innerHTML = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function setQuickReplies(items) {
    quick.innerHTML = '';
    items.forEach((item) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'nx-chip';
      chip.textContent = item.label;
      chip.addEventListener('click', () => handleUserInput(item.value, item.label));
      quick.appendChild(chip);
    });
  }

  function botSay(text, replies) {
    addMsg(text, 'bot');
    setQuickReplies(replies || []);
  }

  function startContactFlow() {
    state = { mode: 'contact-nom', data: {} };
    setQuickReplies([]);
    botSay('Avec plaisir ! Quel est votre nom ?');
  }

  function submitContact() {
    botSay('Merci, j\'envoie votre demande…');
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.data),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        botSay('C\'est envoyé ! Merci, on vous répond très vite. 🎉', QUICK_REPLIES_MAIN);
      })
      .catch(() => {
        botSay('Désolé, l\'envoi a échoué. Vous pouvez aussi utiliser le formulaire de contact plus bas sur la page.', QUICK_REPLIES_MAIN);
      })
      .finally(() => {
        state = { mode: 'idle', data: {} };
      });
  }

  function handleUserInput(rawText, displayText) {
    const text = (rawText || '').trim();
    if (!text) return;
    addMsg(displayText || text, 'user');

    // --- Flux de collecte du formulaire de contact ---
    if (state.mode === 'contact-nom') {
      state.data.nom = text;
      state.mode = 'contact-entreprise';
      return botSay('Merci ' + text + ' ! Quel est le nom de votre entreprise (ou votre nom d\'artiste) ?');
    }
    if (state.mode === 'contact-entreprise') {
      state.data.entreprise = text;
      state.mode = 'contact-courriel';
      return botSay('Quel est votre courriel ?');
    }
    if (state.mode === 'contact-courriel') {
      if (!isValidEmail(text)) {
        return botSay('Hmm, ce courriel ne semble pas valide. Pouvez-vous le réécrire ?');
      }
      state.data.courriel = text;
      state.mode = 'contact-telephone';
      return botSay('Quel est votre numéro de téléphone ?');
    }
    if (state.mode === 'contact-telephone') {
      state.data.telephone = text;
      state.mode = 'contact-besoin';
      return botSay('Quel est votre besoin principal ?', [
        { label: 'Référencement & Google Maps', value: 'seo' },
        { label: 'Formation / Coaching', value: 'formation' },
        { label: 'Autre', value: 'autre' },
      ]);
    }
    if (state.mode === 'contact-besoin') {
      const key = ['seo', 'formation'].includes(text) ? text : 'autre';
      state.data.besoin = key;
      state.mode = 'contact-message';
      return botSay('Parfait — un dernier mot pour décrire votre demande ?');
    }
    if (state.mode === 'contact-message') {
      state.data.message = text;
      return submitContact();
    }

    // --- Mode normal : FAQ ---
    if (text === 'contact') return startContactFlow();
    if (text === 'services' || text === 'formations') {
      const answer = findFaqAnswer(text);
      return botSay(answer, QUICK_REPLIES_MAIN);
    }

    const answer = findFaqAnswer(text);
    if (answer) {
      return botSay(answer, QUICK_REPLIES_MAIN);
    }
    botSay('Je ne suis pas certain de bien comprendre. Voici ce que je peux faire :', QUICK_REPLIES_MAIN);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value;
    input.value = '';
    handleUserInput(val);
  });

  btn.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && body.children.length === 0) {
      botSay('Bonjour 👋 Je suis l\'assistant de Nex System. Comment puis-je vous aider ?', QUICK_REPLIES_MAIN);
    }
  });
  panel.querySelector('#nx-chat-close').addEventListener('click', () => {
    panel.classList.remove('open');
  });
})();
