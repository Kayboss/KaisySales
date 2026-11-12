/* ============================================
   KaisySales — Contact form
   Posts to the `contact` edge function, which validates the fields, throttles
   repeats and stores the message for the admin Inbox. Nothing is emailed.
   ============================================ */

(function () {
  'use strict';

  // Public by design: this is the same anon key the app bundle already serves,
  // and it grants no database access on its own (RLS is the only protection).
  // It is sent so the form works whether or not the function gateway is
  // verifying JWTs; the function still accepts or refuses on its own terms.
  var ENDPOINT = 'https://mjrfvwtgoiukpbpdpuvq.supabase.co/functions/v1/contact';
  var ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcmZ2d3Rnb2l1a3BicGRwdXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NzQ5OTksImV4cCI6MjA5NTA1MDk5OX0.Yk4ePMBZti2suZH7giGb1hNuJ-MRWWT6qwTdRwHsyzc';

  var form = document.getElementById('contactForm');
  var success = document.getElementById('contactSuccess');
  var status = document.getElementById('contactStatus');
  var submit = document.getElementById('contactSubmit');
  var again = document.getElementById('contactAgain');

  if (!form || !success || !status || !submit) return;

  var GENERIC = "We couldn't send that just now. Please try again in a moment.";

  function setStatus(text, tone) {
    status.textContent = text || '';
    if (tone) {
      status.setAttribute('data-tone', tone);
    } else {
      status.removeAttribute('data-tone');
    }
  }

  function setBusy(busy) {
    submit.disabled = busy;
    submit.textContent = busy ? 'Sending\u2026' : 'Send message';
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submit.disabled) return;
    if (form.reportValidity && !form.reportValidity()) return;

    var fields = form.elements;
    var payload = {
      name: fields.name.value.trim(),
      email: fields.email.value.trim(),
      subject: fields.subject.value,
      message: fields.message.value.trim(),
      website: fields.website.value, // honeypot: people never see it
      sourcePage: window.location.pathname
    };

    setBusy(true);
    setStatus('Sending\u2026', null);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: 'Bearer ' + ANON_KEY
      },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () { return {}; })
          .then(function (body) {
            return { ok: response.ok, status: response.status, body: body || {} };
          });
      })
      .then(function (result) {
        if (result.ok && result.body.ok) {
          form.reset();
          form.hidden = true;
          success.hidden = false;
          success.setAttribute('tabindex', '-1');
          success.focus();
          setStatus('', null);
          return;
        }
        if (result.status === 429) {
          setStatus(
            result.body.error || 'Please wait a little before sending another message.',
            'error'
          );
          return;
        }
        setStatus(result.body.error || GENERIC, 'error');
      })
      .catch(function () {
        setStatus(GENERIC, 'error');
      })
      .then(function () {
        setBusy(false);
      });
  });

  if (again) {
    again.addEventListener('click', function () {
      success.hidden = true;
      form.hidden = false;
      setStatus('', null);
      var first = document.getElementById('contactName');
      if (first) first.focus();
    });
  }
})();
