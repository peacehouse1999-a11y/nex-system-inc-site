// Worker principal du site nex-system-inc
//
// Rôle :
//   - Sert les fichiers statiques du site (index.html, etc.) via le binding ASSETS
//   - Gère POST /api/contact : reçoit le formulaire de contact, le valide,
//     puis envoie un courriel de notification via l'API Resend.
//
// Variables et secrets à configurer dans Cloudflare
// (Paramètres > Variables et secrets) :
//   RESEND_API_KEY     — clé API Resend (https://resend.com)
//   CONTACT_TO_EMAIL   — adresse qui reçoit les demandes
//   CONTACT_FROM_EMAIL — adresse expéditrice (ex: onboarding@resend.dev)
//
// Si RESEND_API_KEY n'est pas configurée, la fonction journalise la
// demande (visible dans Observabilité > Logs) et répond quand même avec
// succès, pour ne jamais bloquer un visiteur.

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function handleContact(request, env) {
  let data;
  try {
    data = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid-json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const nom = (data.nom || '').toString().trim();
  const entreprise = (data.entreprise || '').toString().trim();
  const courriel = (data.courriel || '').toString().trim();
  const telephone = (data.telephone || '').toString().trim();
  const besoin = (data.besoin || '').toString().trim();
  const message = (data.message || '').toString().trim();

  if (!nom || !entreprise || !courriel || !telephone || !besoin || !message) {
    return new Response(JSON.stringify({ ok: false, error: 'missing-fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isValidEmail(courriel)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid-email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const besoinLabels = {
    seo: 'Référencement Local & Google Maps',
    ads: 'Publicité Payante (Ads)',
    formation: 'Formation / Coaching',
    artiste: 'Programme Artistes',
    autre: 'Autre',
  };

  const summary =
    `Nouvelle demande de contact — Nex System\n\n` +
    `Nom : ${nom}\n` +
    `Entreprise / Artiste : ${entreprise}\n` +
    `Courriel : ${courriel}\n` +
    `Téléphone : ${telephone}\n` +
    `Besoin : ${besoinLabels[besoin] || besoin}\n\n` +
    `Message :\n${message}\n`;

  if (env.RESEND_API_KEY && env.CONTACT_TO_EMAIL && env.CONTACT_FROM_EMAIL) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.CONTACT_FROM_EMAIL,
          to: env.CONTACT_TO_EMAIL,
          reply_to: courriel,
          subject: `Nouvelle demande — ${entreprise}`,
          text: summary,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("Resend a refusé l'envoi", res.status, detail);
        return new Response(JSON.stringify({ ok: false, error: 'email-provider-error' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error("Erreur lors de l'appel à Resend", err);
      return new Response(JSON.stringify({ ok: false, error: 'email-provider-error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    console.log("Formulaire de contact reçu (aucun fournisseur d'e-mail configuré) :", summary);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      if (request.method === 'POST') {
        return handleContact(request, env);
      }
      return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Tout le reste : fichiers statiques (index.html, _headers, robots.txt, etc.)
    return env.ASSETS.fetch(request);
  },
};
