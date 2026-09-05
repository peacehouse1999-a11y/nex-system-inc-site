// Cloudflare Pages Function — POST /api/contact
//
// Reçoit les données du formulaire de contact du site, les valide,
// puis envoie un courriel de notification via l'API Resend.
//
// Variables d'environnement à configurer dans le tableau de bord
// Cloudflare Pages (Settings > Environment variables) :
//   RESEND_API_KEY   — clé API Resend (https://resend.com)
//   CONTACT_TO_EMAIL — adresse qui reçoit les demandes (ex: contact@nexsystem.ca)
//   CONTACT_FROM_EMAIL — adresse expéditrice vérifiée sur Resend
//     (ex: no-reply@nexsystem.ca)
//
// Si RESEND_API_KEY n'est pas configurée, la fonction se contente de
// journaliser la demande (visible dans les logs Cloudflare Pages) et
// répond quand même avec succès, pour ne jamais bloquer un visiteur —
// à activer dès que vous avez un fournisseur d'e-mail transactionnel.

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function onRequestPost(context) {
  const { request, env } = context;

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
        console.error('Resend a refusé l\'envoi', res.status, detail);
        return new Response(JSON.stringify({ ok: false, error: 'email-provider-error' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (err) {
      console.error('Erreur lors de l\'appel à Resend', err);
      return new Response(JSON.stringify({ ok: false, error: 'email-provider-error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    // Pas de fournisseur d'e-mail configuré : on journalise pour ne pas
    // perdre la demande, sans bloquer le visiteur.
    console.log('Formulaire de contact reçu (aucun fournisseur d\'e-mail configuré) :', summary);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Toute autre méthode que POST est refusée.
export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: false, error: 'method-not-allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  });
}
