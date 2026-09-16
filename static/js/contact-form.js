(function () {
  "use strict";

  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitBtn = document.getElementById("contact-submit");
  const label = submitBtn.querySelector(".btn__label");
  const spinner = submitBtn.querySelector(".btn__spinner");

  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function clearErrors() {
    form.querySelectorAll(".field__error").forEach(function (el) { el.textContent = ""; });
  }

  function showError(field, message) {
    const el = form.querySelector('[data-error-for="' + field + '"]');
    if (el) el.textContent = message;
  }

  function validate(data) {
    const errors = {};
    if (!data.name) errors.name = "Please enter your name.";
    if (!data.email || !EMAIL_RE.test(data.email)) errors.email = "Please enter a valid email address.";
    if (!data.project_type) errors.project_type = "Please choose a project type.";
    if (!data.message || data.message.trim().length < 10) errors.message = "Please add a few details about your project.";
    return errors;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    spinner.hidden = !isLoading;
    label.textContent = isLoading ? "Sending..." : "Send message";
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    clearErrors();
    statusEl.textContent = "";
    statusEl.className = "form-status";

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const errors = validate(data);
    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (field) { showError(field, errors[field]); });
      statusEl.textContent = "Please fix the highlighted fields.";
      statusEl.classList.add("is-error");
      return;
    }

    setLoading(true);

    try {
      data.request_id = crypto.randomUUID();
      const res = await window.PortfolioAPI.request("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(function () { return {}; });

      if (!res.ok) {
        if (result.fields) {
          Object.keys(result.fields).forEach(function (field) { showError(field, result.fields[field]); });
        }
        statusEl.textContent = result.error || "Something went wrong. Please try again.";
        statusEl.classList.add("is-error");
        return;
      }

      statusEl.textContent = result.message || "Thanks — your message is on its way.";
      statusEl.classList.add("is-success");
      form.reset();
    } catch (err) {
      statusEl.textContent = "Network error — please check your connection and try again.";
      statusEl.classList.add("is-error");
    } finally {
      setLoading(false);
    }
  });
})();
