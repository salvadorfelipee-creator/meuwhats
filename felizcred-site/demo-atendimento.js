(() => {
  'use strict';

  const root = document.querySelector('[data-fc-demo]');
  if (!root) return;

  const messages = root.querySelector('[data-fc-demo-messages]');
  const stageLabel = root.querySelector('[data-fc-demo-stage]');
  const stageCount = root.querySelector('[data-fc-demo-count]');
  const progressBar = root.querySelector('.fc-demo-progress-track i');
  const pauseButton = root.querySelector('[data-fc-demo-pause]');
  const restartButton = root.querySelector('[data-fc-demo-restart]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const stages = [
    'Boas-vindas',
    'Valor',
    'Prazo',
    'Dados opcionais',
    'Simulação',
    'Link demonstrativo',
    'Imagem opcional',
    'Pix ilustrativo',
    'Conclusão'
  ];

  const initialState = () => ({
    amount: 2500,
    term: 12,
    firstName: '',
    photoUrl: '',
    paused: false,
    finished: false
  });

  let state = initialState();
  let destroyed = false;

  const timerQueue = (() => {
    const jobs = new Set();

    const arm = (job) => {
      job.startedAt = Date.now();
      job.id = window.setTimeout(() => {
        jobs.delete(job);
        if (!destroyed && !state.paused) job.callback();
      }, Math.max(0, job.remaining));
    };

    return {
      add(callback, delay) {
        const job = {
          callback,
          remaining: reducedMotion.matches ? Math.min(delay, 80) : delay,
          startedAt: 0,
          id: 0
        };
        jobs.add(job);
        if (!state.paused) arm(job);
        return job;
      },
      pause() {
        jobs.forEach((job) => {
          window.clearTimeout(job.id);
          job.remaining = Math.max(0, job.remaining - (Date.now() - job.startedAt));
        });
      },
      resume() {
        jobs.forEach(arm);
      },
      clear() {
        jobs.forEach((job) => window.clearTimeout(job.id));
        jobs.clear();
      }
    };
  })();

  const formatMoney = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);

  const timeNow = () => new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());

  const scrollToLatest = () => {
    window.requestAnimationFrame(() => {
      messages.scrollTo({
        top: messages.scrollHeight,
        behavior: reducedMotion.matches ? 'auto' : 'smooth'
      });
    });
  };

  const setStage = (index) => {
    const safeIndex = Math.max(0, Math.min(index, stages.length - 1));
    stageLabel.textContent = stages[safeIndex];
    stageCount.textContent = `Etapa ${safeIndex + 1} de ${stages.length}`;
    progressBar.style.setProperty('--fc-demo-progress', String((safeIndex + 1) / stages.length));
  };

  const makeBubble = (kind, text) => {
    const bubble = document.createElement('div');
    bubble.className = `fc-demo-bubble fc-demo-bubble--${kind} fc-demo-enter`;

    const copy = document.createElement('p');
    copy.textContent = text;
    bubble.appendChild(copy);

    const time = document.createElement('time');
    time.dateTime = new Date().toISOString();
    time.textContent = timeNow();
    bubble.appendChild(time);

    messages.appendChild(bubble);
    scrollToLatest();
    return bubble;
  };

  const addAssistant = (text) => makeBubble('assistant', text);
  const addClient = (text) => makeBubble('client', text);

  const addStaticBlock = (className, html) => {
    const block = document.createElement('div');
    block.className = `${className} fc-demo-enter`;
    block.innerHTML = html;
    messages.appendChild(block);
    scrollToLatest();
    return block;
  };

  const showTyping = (callback, delay = 520) => {
    const typing = addStaticBlock(
      'fc-demo-typing',
      '<span class="sr-only">Assistente digitando</span><i></i><i></i><i></i>'
    );
    timerQueue.add(() => {
      typing.remove();
      callback();
      scrollToLatest();
    }, delay);
  };

  const disableGroup = (source) => {
    const group = source.closest('.fc-demo-actions, .fc-demo-form, .fc-demo-upload-actions');
    if (!group) return;
    group.classList.add('is-complete');
    group.querySelectorAll('button, input').forEach((control) => {
      control.disabled = true;
    });
  };

  const actions = (items, extraClass = '') => {
    const wrapper = document.createElement('div');
    wrapper.className = `fc-demo-actions fc-demo-enter ${extraClass}`.trim();
    items.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = item.secondary ? 'fc-demo-choice fc-demo-choice--secondary' : 'fc-demo-choice';
      button.dataset.action = item.action;
      if (item.value !== undefined) button.dataset.value = item.value;
      button.textContent = item.label;
      wrapper.appendChild(button);
    });
    messages.appendChild(wrapper);
    scrollToLatest();
    return wrapper;
  };

  const askAmount = () => {
    setStage(1);
    showTyping(() => {
      addAssistant('Qual valor você gostaria de simular? Os valores são apenas exemplos, sem garantia de aprovação ou oferta real.');
      actions([
        { label: 'R$ 1.000', action: 'amount', value: '1000' },
        { label: 'R$ 2.500', action: 'amount', value: '2500' },
        { label: 'R$ 5.000', action: 'amount', value: '5000' },
        { label: 'Outro valor', action: 'custom-amount', secondary: true }
      ]);
    });
  };

  const askTerm = () => {
    setStage(2);
    showTyping(() => {
      addAssistant('Em quantas parcelas gostaria de visualizar a simulação?');
      actions([
        { label: '6 parcelas', action: 'term', value: '6' },
        { label: '12 parcelas', action: 'term', value: '12' },
        { label: '18 parcelas', action: 'term', value: '18' },
        { label: 'Não sei, quero comparar', action: 'term', value: 'compare', secondary: true }
      ]);
    });
  };

  const showContactForm = () => {
    setStage(3);
    showTyping(() => {
      addAssistant('Em um atendimento real, esses dados ajudariam no contato. Aqui eles são opcionais, fictícios e ficam somente neste navegador.');
      addStaticBlock('fc-demo-form-wrap', `
        <form class="fc-demo-form" data-contact-form novalidate>
          <div class="fc-demo-field">
            <label for="fc-demo-name">Nome</label>
            <input id="fc-demo-name" name="name" type="text" autocomplete="off" aria-describedby="fc-demo-name-error" placeholder="Ex.: Ana Souza">
            <span class="fc-demo-field-error" id="fc-demo-name-error" data-error-for="name" role="alert"></span>
          </div>
          <div class="fc-demo-field">
            <label for="fc-demo-email">E-mail</label>
            <input id="fc-demo-email" name="email" type="email" autocomplete="off" aria-describedby="fc-demo-email-error" placeholder="ana@exemplo.com">
            <span class="fc-demo-field-error" id="fc-demo-email-error" data-error-for="email" role="alert"></span>
          </div>
          <div class="fc-demo-field">
            <label for="fc-demo-phone">Telefone</label>
            <input id="fc-demo-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" aria-describedby="fc-demo-phone-error" placeholder="(11) 99999-0000">
            <span class="fc-demo-field-error" id="fc-demo-phone-error" data-error-for="phone" role="alert"></span>
          </div>
          <p class="fc-demo-form-note">Nada será enviado, salvo ou usado para contato.</p>
          <div class="fc-demo-form-actions">
            <button class="fc-demo-choice" type="submit">Continuar</button>
            <button class="fc-demo-choice fc-demo-choice--secondary" type="button" data-action="demo-contact">Usar dados fictícios</button>
            <button class="fc-demo-text-button" type="button" data-action="skip-contact">Pular dados</button>
          </div>
        </form>
      `);
    });
  };

  const estimatedInstallment = (months) => state.amount * (1.08 + (months / 1000)) / months;

  const simulationCard = () => {
    const isComparison = state.term === 'compare';
    const termCopy = isComparison ? 'Comparação de 6, 12 e 18 parcelas' : `${state.term} parcelas`;
    const estimateCopy = isComparison
      ? [6, 12, 18].map((months) => `
          <li><span>${months}x ilustrativas</span><strong>${formatMoney(estimatedInstallment(months))}</strong></li>
        `).join('')
      : `<li><span>${state.term}x ilustrativas</span><strong>${formatMoney(estimatedInstallment(state.term))}</strong></li>`;

    return addStaticBlock('fc-demo-simulation', `
      <div class="fc-demo-simulation-head">
        <span>Simulação demonstrativa</span>
        <strong>${formatMoney(state.amount)}</strong>
      </div>
      <dl>
        <div><dt>Valor escolhido</dt><dd>${formatMoney(state.amount)}</dd></div>
        <div><dt>Prazo</dt><dd>${termCopy}</dd></div>
      </dl>
      <ul class="fc-demo-estimates" aria-label="Parcelas ilustrativas">${estimateCopy}</ul>
      <p class="fc-demo-simulation-warning">Exemplo demonstrativo — não é oferta, aprovação ou proposta de crédito.</p>
      <button class="fc-demo-detail-button" type="button" data-action="details" aria-expanded="false">Ver detalhes</button>
      <div class="fc-demo-details" hidden>
        <strong>Como este exemplo foi montado</strong>
        <p>As parcelas são estimativas fictícias para visualizar o fluxo. Não houve consulta de crédito, cálculo de taxa real ou análise por uma instituição.</p>
        <button class="fc-demo-choice" type="button" data-action="continue-link">Continuar para o link</button>
      </div>
    `);
  };

  const showSimulation = () => {
    setStage(4);
    showTyping(() => {
      const greeting = state.firstName ? `${state.firstName}, preparei` : 'Preparei';
      addAssistant(`${greeting} um exemplo com as escolhas feitas. Confira com calma: ele não representa condições reais.`);
      simulationCard();
    }, 640);
  };

  const showLinkStep = () => {
    setStage(5);
    showTyping(() => {
      addAssistant('Quer receber um link demonstrativo para consultar esta simulação depois?');
      actions([{ label: 'Mostrar link', action: 'show-link' }]);
    });
  };

  const showPhotoStep = () => {
    setStage(6);
    showTyping(() => {
      addAssistant('Em um processo real, documentos podem ser solicitados somente por canais oficiais e seguros. Nesta demonstração, não envie documento nem selfie. Se quiser, escolha apenas uma imagem de exemplo para visualizar localmente.');
      addStaticBlock('fc-demo-upload', `
        <input class="fc-demo-file-input" id="fc-demo-file" type="file" accept="image/*" data-photo-input>
        <div class="fc-demo-upload-actions">
          <label class="fc-demo-choice" for="fc-demo-file">Escolher imagem de exemplo</label>
          <button class="fc-demo-choice fc-demo-choice--secondary" type="button" data-action="skip-photo">Pular esta etapa</button>
        </div>
        <div class="fc-demo-preview" data-photo-preview hidden></div>
      `);
    });
  };

  const showPixStep = () => {
    setStage(7);
    showTyping(() => {
      addAssistant('Em uma contratação real, qualquer custo ou pagamento deve ser informado e confirmado nos canais oficiais da instituição. Esta demonstração não gera cobrança.');
      addStaticBlock('fc-demo-pix', `
        <span class="fc-demo-pix-label">Exemplo de confirmação — sem pagamento</span>
        <strong>pix-nao-real@exemplo.invalid</strong>
        <p class="fc-demo-pix-warning">Demonstração. Não pague, não copie para fazer uma transferência e não há cobrança real.</p>
        <div class="fc-demo-pix-actions">
          <button class="fc-demo-detail-button" type="button" data-action="copy-pix">Copiar texto demonstrativo</button>
          <button class="fc-demo-choice" type="button" data-action="finish">Concluir demonstração</button>
        </div>
        <span class="fc-demo-copy-feedback" data-pix-feedback role="status" aria-live="polite"></span>
      `);
    }, 620);
  };

  const finishDemo = () => {
    if (state.finished) return;
    state.finished = true;
    setStage(8);
    addClient('Concluir demonstração');
    showTyping(() => {
      addAssistant('Pronto! Você concluiu a demonstração do atendimento. Nenhum dado foi enviado e nenhuma proposta ou cobrança foi criada.');
      actions([{ label: 'Recomeçar demonstração', action: 'restart' }], 'fc-demo-actions--final');
    });
  };

  const proceedAfterContact = (clientText) => {
    addClient(clientText);
    showSimulation();
  };

  const validateContact = (form) => {
    const values = Object.fromEntries(new FormData(form));
    const digits = String(values.phone || '').replace(/\D/g, '');
    const errors = {
      name: String(values.name || '').trim().length >= 2 ? '' : 'Digite um nome com pelo menos 2 caracteres.',
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email || '').trim()) ? '' : 'Digite um e-mail em formato válido.',
      phone: digits.length >= 10 && digits.length <= 11 ? '' : 'Digite um telefone com DDD.'
    };

    let firstInvalid = null;
    Object.entries(errors).forEach(([name, error]) => {
      const input = form.elements[name];
      const errorNode = form.querySelector(`[data-error-for="${name}"]`);
      input.setAttribute('aria-invalid', error ? 'true' : 'false');
      errorNode.textContent = error;
      if (error && !firstInvalid) firstInvalid = input;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }

    return values;
  };

  const parsePositiveAmount = (raw) => {
    const normalized = String(raw).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const copyText = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch (_error) {
      return false;
    }
  };

  const clearPhoto = () => {
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = '';
  };

  const restart = () => {
    timerQueue.clear();
    clearPhoto();
    state = initialState();
    root.classList.remove('is-paused');
    pauseButton.classList.remove('is-paused');
    pauseButton.setAttribute('aria-pressed', 'false');
    pauseButton.setAttribute('aria-label', 'Pausar demonstração');
    messages.innerHTML = '';
    messages.classList.add('is-opening');
    setStage(0);

    addStaticBlock('fc-demo-day', '<span>Demonstração de hoje</span>');
    addAssistant('Olá! Que bom ter você por aqui. Posso mostrar uma simulação demonstrativa de empréstimo. Tudo bem?');
    actions([
      { label: 'Sim, vamos começar', action: 'start' },
      { label: 'Quero tirar uma dúvida', action: 'question', secondary: true }
    ]);
  };

  root.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || !root.contains(button) || state.paused) return;

    const action = button.dataset.action;

    if (action === 'restart') {
      restart();
      return;
    }

    if (action === 'start' || action === 'continue-start') {
      disableGroup(button);
      messages.classList.remove('is-opening');
      addClient(action === 'start' ? 'Sim, vamos começar' : 'Continuar simulação');
      askAmount();
      return;
    }

    if (action === 'question') {
      disableGroup(button);
      messages.classList.remove('is-opening');
      addClient('Quero tirar uma dúvida');
      showTyping(() => {
        addAssistant('Claro. Esta simulação é apenas demonstrativa. Condições reais dependem da análise da instituição e não há promessa de aprovação.');
        actions([
          { label: 'Continuar simulação', action: 'continue-start' },
          { label: 'Recomeçar', action: 'restart', secondary: true }
        ]);
      });
      return;
    }

    if (action === 'amount') {
      disableGroup(button);
      state.amount = Number(button.dataset.value);
      addClient(formatMoney(state.amount));
      askTerm();
      return;
    }

    if (action === 'custom-amount') {
      disableGroup(button);
      addClient('Quero informar outro valor');
      addStaticBlock('fc-demo-value-form-wrap', `
        <form class="fc-demo-value-form" data-amount-form novalidate>
          <label for="fc-demo-amount">Valor de exemplo</label>
          <div><span>R$</span><input id="fc-demo-amount" name="amount" type="text" inputmode="decimal" placeholder="3.000,00" aria-describedby="fc-demo-amount-help fc-demo-amount-error"></div>
          <small id="fc-demo-amount-help">Informe um valor positivo. Isso não gera uma oferta.</small>
          <span class="fc-demo-field-error" id="fc-demo-amount-error" data-amount-error role="alert"></span>
          <button class="fc-demo-choice" type="submit">Usar este valor</button>
        </form>
      `).querySelector('input').focus();
      return;
    }

    if (action === 'term') {
      disableGroup(button);
      state.term = button.dataset.value === 'compare' ? 'compare' : Number(button.dataset.value);
      addClient(state.term === 'compare' ? 'Não sei, quero comparar' : `${state.term} parcelas`);
      showContactForm();
      return;
    }

    if (action === 'demo-contact') {
      const form = button.closest('form');
      form.elements.name.value = 'Ana Exemplo';
      form.elements.email.value = 'ana@exemplo.com';
      form.elements.phone.value = '(11) 99999-0000';
      state.firstName = 'Ana';
      disableGroup(button);
      proceedAfterContact('Vou usar os dados fictícios de demonstração');
      return;
    }

    if (action === 'skip-contact') {
      disableGroup(button);
      state.firstName = '';
      proceedAfterContact('Prefiro pular os dados');
      return;
    }

    if (action === 'details') {
      const card = button.closest('.fc-demo-simulation');
      const details = card.querySelector('.fc-demo-details');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!expanded));
      button.textContent = expanded ? 'Ver detalhes' : 'Ocultar detalhes';
      details.hidden = expanded;
      scrollToLatest();
      return;
    }

    if (action === 'continue-link') {
      button.disabled = true;
      addClient('Quero continuar');
      showLinkStep();
      return;
    }

    if (action === 'show-link') {
      disableGroup(button);
      addClient('Mostrar link');
      addStaticBlock('fc-demo-link-card', `
        <span>Link fictício da demonstração</span>
        <strong>felizcred.exemplo/simulacao</strong>
        <button class="fc-demo-detail-button" type="button" data-action="copy-link">Copiar link fictício</button>
        <span class="fc-demo-copy-feedback" data-link-feedback role="status" aria-live="polite"></span>
        <button class="fc-demo-choice" type="button" data-action="continue-photo">Continuar</button>
      `);
      return;
    }

    if (action === 'copy-link') {
      await copyText('felizcred.exemplo/simulacao');
      const feedback = button.closest('.fc-demo-link-card').querySelector('[data-link-feedback]');
      feedback.textContent = 'Link fictício copiado';
      button.textContent = 'Copiado';
      return;
    }

    if (action === 'continue-photo') {
      button.disabled = true;
      addClient('Continuar');
      showPhotoStep();
      return;
    }

    if (action === 'skip-photo') {
      disableGroup(button);
      addClient('Pular esta etapa');
      showPixStep();
      return;
    }

    if (action === 'remove-photo') {
      clearPhoto();
      const upload = button.closest('.fc-demo-upload');
      upload.querySelector('[data-photo-input]').value = '';
      upload.querySelector('[data-photo-preview]').hidden = true;
      upload.querySelector('.fc-demo-upload-actions').hidden = false;
      upload.querySelector('label').focus();
      return;
    }

    if (action === 'use-photo') {
      button.disabled = true;
      addClient('Usar apenas esta prévia local');
      showPixStep();
      return;
    }

    if (action === 'copy-pix') {
      await copyText('DEMONSTRAÇÃO — pix-nao-real@exemplo.invalid — NÃO USE PARA PAGAMENTO');
      const feedback = button.closest('.fc-demo-pix').querySelector('[data-pix-feedback]');
      feedback.textContent = 'Texto fictício copiado — não use para pagamento';
      button.textContent = 'Texto demonstrativo copiado';
      return;
    }

    if (action === 'finish') {
      button.disabled = true;
      finishDemo();
    }
  });

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.paused) return;

    if (event.target.matches('[data-amount-form]')) {
      const form = event.target;
      const value = parsePositiveAmount(form.elements.amount.value);
      const error = form.querySelector('[data-amount-error]');
      if (!value) {
        form.elements.amount.setAttribute('aria-invalid', 'true');
        error.textContent = 'Digite um valor maior que zero.';
        form.elements.amount.focus();
        return;
      }
      form.elements.amount.setAttribute('aria-invalid', 'false');
      error.textContent = '';
      state.amount = value;
      form.querySelectorAll('button, input').forEach((control) => { control.disabled = true; });
      addClient(formatMoney(state.amount));
      askTerm();
      return;
    }

    if (event.target.matches('[data-contact-form]')) {
      const values = validateContact(event.target);
      if (!values) return;
      state.firstName = String(values.name).trim().split(/\s+/)[0];
      event.target.querySelectorAll('button, input').forEach((control) => { control.disabled = true; });
      proceedAfterContact(`Dados preenchidos localmente para ${state.firstName}`);
    }
  });

  root.addEventListener('input', (event) => {
    const form = event.target.closest('[data-contact-form]');
    if (form && event.target.name) {
      event.target.setAttribute('aria-invalid', 'false');
      const error = form.querySelector(`[data-error-for="${event.target.name}"]`);
      if (error) error.textContent = '';
    }
    if (event.target.matches('[data-amount-form] input')) {
      event.target.setAttribute('aria-invalid', 'false');
      event.target.closest('form').querySelector('[data-amount-error]').textContent = '';
    }
  });

  root.addEventListener('change', (event) => {
    const input = event.target.closest('[data-photo-input]');
    if (!input || !input.files || !input.files[0]) return;

    const file = input.files[0];
    const preview = input.closest('.fc-demo-upload').querySelector('[data-photo-preview]');
    if (!file.type.startsWith('image/')) {
      preview.hidden = false;
      preview.innerHTML = '<p class="fc-demo-field-error" role="alert">Escolha um arquivo de imagem.</p>';
      return;
    }

    clearPhoto();
    state.photoUrl = URL.createObjectURL(file);
    preview.innerHTML = `
      <img src="${state.photoUrl}" alt="Prévia local da imagem escolhida">
      <div><strong>Prévia somente neste navegador</strong><span>A imagem não foi enviada — esta visualização é local.</span></div>
      <div class="fc-demo-preview-actions">
        <button class="fc-demo-text-button" type="button" data-action="remove-photo">Remover imagem</button>
        <button class="fc-demo-choice" type="button" data-action="use-photo">Continuar com a prévia</button>
      </div>
    `;
    preview.hidden = false;
    input.closest('.fc-demo-upload').querySelector('.fc-demo-upload-actions').hidden = true;
    preview.querySelector('[data-action="use-photo"]').focus();
    scrollToLatest();
  });

  pauseButton.addEventListener('click', () => {
    state.paused = !state.paused;
    root.classList.toggle('is-paused', state.paused);
    pauseButton.classList.toggle('is-paused', state.paused);
    pauseButton.setAttribute('aria-pressed', String(state.paused));
    pauseButton.setAttribute('aria-label', state.paused ? 'Continuar demonstração' : 'Pausar demonstração');
    if (state.paused) timerQueue.pause();
    else timerQueue.resume();
  });

  restartButton.addEventListener('click', restart);

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    timerQueue.clear();
    clearPhoto();
  };

  window.addEventListener('pagehide', cleanup, { once: true });

  const observer = new MutationObserver(() => {
    if (!document.documentElement.contains(root)) {
      observer.disconnect();
      cleanup();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  restart();
})();
