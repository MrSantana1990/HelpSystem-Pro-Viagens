import React, { useState } from 'react';
import type {
  TripDetail,
  SavedScenario,
} from '../../../packages/contracts/src/persistence.js';
import type {
  SearchInput,
  SearchResult,
  Scenario,
} from '../../../packages/contracts/src/index.js';
import './styles.css';
const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);
const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(value + 'T00:00:00Z'));
const initial: SearchInput = {
  origin: 'SSA',
  destination: 'REC',
  month: new Date().toISOString().slice(0, 7),
  nights: 5,
  travelers: 2,
  rooms: 1,
  budgetCents: 600000,
  foodPerPersonDayCents: 10000,
  transportPerDayCents: 6000,
  activitiesPerPersonCents: 25000,
  doorToDoorCents: 20000,
};
const labels: Record<string, string> = {
  flights: 'Passagens · ida e volta',
  hotels: 'Hospedagem',
  food: 'Alimentação',
  transport: 'Transporte no destino',
  activities: 'Passeios',
  doorToDoor: 'Porta a porta',
};
export function Planner({
  trip,
  editing,
  onSave,
  signedIn,
  accountLoading,
  onRequireAccount,
}: {
  signedIn: boolean;
  accountLoading: boolean;
  onRequireAccount: () => void;
  trip: TripDetail | null;
  editing: SavedScenario | null;
  onSave: (
    title: string,
    input: SearchInput,
    scenario: Scenario | null,
    scenarioTitle: string,
  ) => Promise<void>;
}) {
  const [title, setTitle] = useState(trip?.title ?? 'Minha próxima viagem');
  const [scenarioTitle, setScenarioTitle] = useState(
    editing?.title ?? 'Principal',
  );
  const [saved, setSaved] = useState('');
  const [form, setRawForm] = useState(editing?.input ?? trip?.input ?? initial);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Scenario | null>(
    editing?.snapshot ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function setForm(input: SearchInput) {
    setRawForm(input);
    setResult(null);
    setSelected(null);
    setSaved('');
  }
  async function save() {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      await onSave(title, form, selected, scenarioTitle);
      setSaved('Plano salvo.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }
  function number(key: keyof SearchInput, value: string, multiplier = 1) {
    setForm({ ...form, [key]: Math.round(Number(value) * multiplier) });
  }
  async function search(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    setSelected(null);
    try {
      const response = await fetch('/v1/search/month', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(
          body.error?.message ?? 'Não foi possível analisar a viagem.',
        );
      }
      const data = (await response.json()) as SearchResult;
      setResult(data);
      setSelected(data.ranking[0] ?? null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Falha de conexão. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell">
      <header>
        <a className="brand" href="/">
          <span className="brand-mark">h.</span>
          <span>
            HelpSystem Pro <strong>Viagens</strong>
          </span>
        </a>
        <span className="preview">PRÉVIA DO PRODUTO</span>
      </header>
      <main>
        <section className="hero">
          <div>
            <p className="eyebrow">MENOS INCERTEZA. MAIS VIAGEM.</p>
            <h1>
              Seu próximo destino.
              <br />
              <em>Dentro dos seus planos.</em>
            </h1>
            <p className="intro">
              Encontre o melhor momento para viajar olhando para o que realmente
              importa: o custo da viagem inteira.
            </p>
            <div className="hero-tags">
              <span>01 · Explore o mês</span>
              <span>02 · Compare o custo total</span>
              <span>03 · Escolha sua data</span>
            </div>
          </div>
          <aside className="hero-note">
            <span className="compass">↗</span>
            <p>
              Uma boa viagem começa
              <br />
              com uma visão completa.
            </p>
            <small>
              Do caminho ao aeroporto
              <br />
              ao último passeio.
            </small>
          </aside>
        </section>
        <div className="demo-notice">
          <strong>Modo demonstração</strong> · Passagens e hotéis são simulados.
          Os resultados não são ofertas reais.
        </div>
        <section className="workspace">
          <form onSubmit={search} className="search-panel">
            <div className="section-heading">
              <span className="eyebrow">SEU PONTO DE PARTIDA</span>
              <h2>Vamos desenhar a viagem</h2>
            </div>
            <fieldset disabled={busy}>
              <div className="fields">
                <label className="wide">
                  Nome da viagem
                  <input
                    value={title}
                    required
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Origem · código IATA
                  <input
                    aria-label="Origem"
                    value={form.origin}
                    pattern="[A-Z]{3}"
                    maxLength={3}
                    required
                    onChange={(e) =>
                      setForm({ ...form, origin: e.target.value.toUpperCase() })
                    }
                  />
                </label>
                <label>
                  Destino · código IATA
                  <input
                    aria-label="Destino"
                    value={form.destination}
                    pattern="[A-Z]{3}"
                    maxLength={3}
                    required
                    onChange={(e) =>
                      setForm({
                        ...form,
                        destination: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
                <label>
                  Mês para explorar
                  <input
                    type="month"
                    required
                    value={form.month}
                    onChange={(e) =>
                      setForm({ ...form, month: e.target.value })
                    }
                  />
                </label>
                <label>
                  Noites
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={form.nights}
                    onChange={(e) => number('nights', e.target.value)}
                  />
                </label>
                <label>
                  Viajantes
                  <input
                    type="number"
                    min={1}
                    max={9}
                    required
                    value={form.travelers}
                    onChange={(e) => number('travelers', e.target.value)}
                  />
                </label>
                <label>
                  Quartos
                  <input
                    type="number"
                    min={1}
                    max={form.travelers}
                    required
                    value={form.rooms}
                    onChange={(e) => number('rooms', e.target.value)}
                  />
                </label>
                <label className="wide">
                  Orçamento total do grupo · R$
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    required
                    value={form.budgetCents / 100}
                    onChange={(e) => number('budgetCents', e.target.value, 100)}
                  />
                </label>
              </div>
              <details>
                <summary>Ajustar estimativas do dia a dia</summary>
                <div className="fields estimates">
                  {(
                    [
                      ['foodPerPersonDayCents', 'Alimentação / pessoa / dia'],
                      ['transportPerDayCents', 'Transporte / grupo / dia'],
                      [
                        'activitiesPerPersonCents',
                        'Passeios / pessoa / viagem',
                      ],
                      ['doorToDoorCents', 'Porta a porta / grupo / viagem'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label} · R$
                      <input
                        type="number"
                        min={0}
                        max={1000000}
                        value={form[key] / 100}
                        required
                        onChange={(e) => number(key, e.target.value, 100)}
                      />
                    </label>
                  ))}
                </div>
              </details>
              <button className="primary" type="submit">
                {busy ? 'Analisando o mês…' : 'Explorar melhores datas'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
              <label>
                Nome do cenário
                <input
                  value={scenarioTitle}
                  required
                  maxLength={100}
                  onChange={(e) => setScenarioTitle(e.target.value)}
                />
              </label>
              <button
                className="secondary save-plan"
                type="button"
                disabled={accountLoading}
                onClick={() => (signedIn ? void save() : onRequireAccount())}
              >
                {!signedIn
                  ? 'Salvar meu planejamento'
                  : editing
                    ? 'Atualizar cenário'
                    : selected
                      ? 'Salvar viagem e cenário'
                      : 'Salvar viagem'}
              </button>
              {!signedIn ? (
                <p className="fine">
                  Para salvar e gerenciar suas viagens, entre ou crie uma conta.
                  Seu planejamento fica nesta página enquanto ela estiver
                  aberta.
                </p>
              ) : null}
              {saved ? (
                <p role="status" className="success">
                  {saved}
                </p>
              ) : null}
            </fieldset>
            <p className="fine">
              Valores em reais para o grupo. Alimentação e transporte consideram{' '}
              {form.nights + 1} dias.
            </p>
          </form>
          <section className="results" aria-live="polite" aria-busy={busy}>
            {error ? (
              <p role="alert" className="error">
                {error}
              </p>
            ) : null}
            {!result ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  ◎
                </span>
                <p className="eyebrow">A VIAGEM COMEÇA AQUI</p>
                <h2>
                  O mês inteiro.
                  <br />
                  Todas as possibilidades.
                </h2>
                <p>
                  Preencha seu plano para visualizar os custos por data e as
                  cinco melhores opções para seu orçamento.
                </p>
                <div className="empty-grid" aria-hidden="true">
                  {Array.from({ length: 21 }, (_, i) => (
                    <span key={i} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="section-heading">
                  <span className="eyebrow">SEU MÊS, EM PERSPECTIVA</span>
                  <h2>Cinco datas para considerar</h2>
                  <p>
                    Ranking por orçamento, score e custo total. Todos os valores
                    são simulados.
                  </p>
                </div>
                <ol className="ranking">
                  {result.ranking.map((s, i) => (
                    <li key={s.departure}>
                      <button
                        aria-pressed={selected?.departure === s.departure}
                        onClick={() => setSelected(s)}
                      >
                        <span className="rank">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span>
                          <strong>
                            {date(s.departure)} → {date(s.returnDate)}
                          </strong>
                          <small>
                            {s.withinBudget
                              ? 'Dentro do orçamento'
                              : 'Acima do orçamento'}{' '}
                            · Score {s.score}
                          </small>
                        </span>
                        <b>{money(s.costs.total)}</b>
                      </button>
                    </li>
                  ))}
                </ol>
                <h3>Calendário de partidas</h3>
                <div className="calendar">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <span className="weekday" key={i}>
                      {d}
                    </span>
                  ))}
                  {Array.from(
                    {
                      length: new Date(
                        result.calendar[0]!.departure + 'T00:00:00Z',
                      ).getUTCDay(),
                    },
                    (_, i) => (
                      <span key={'blank' + i} />
                    ),
                  )}
                  {result.calendar.map((s) => (
                    <button
                      className={s.withinBudget ? 'affordable' : 'over'}
                      key={s.departure}
                      aria-pressed={selected?.departure === s.departure}
                      aria-label={
                        date(s.departure) +
                        ': ' +
                        money(s.costs.total) +
                        (s.withinBudget
                          ? ', dentro do orçamento'
                          : ', acima do orçamento')
                      }
                      onClick={() => setSelected(s)}
                    >
                      <strong>{s.departure.slice(-2)}</strong>
                      <small>{money(s.costs.total)}</small>
                    </button>
                  ))}
                </div>
                <p className="fine">
                  Verde: dentro do orçamento · Bege: acima. Selecione uma data
                  para detalhar.
                </p>
                {selected ? (
                  <div className="breakdown">
                    <h3>
                      Sua viagem de {date(selected.departure)} a{' '}
                      {date(selected.returnDate)}
                    </h3>
                    <dl>
                      {Object.entries(labels).map(([key, label]) => (
                        <div key={key}>
                          <dt>{label}</dt>
                          <dd>
                            {money(
                              selected.costs[
                                key as keyof typeof selected.costs
                              ],
                            )}
                          </dd>
                        </div>
                      ))}
                      <div className="total">
                        <dt>Custo total estimado</dt>
                        <dd>{money(selected.costs.total)}</dd>
                      </div>
                    </dl>
                    <p>
                      {selected.withinBudget
                        ? 'Saldo no orçamento: '
                        : 'Acima do orçamento: '}
                      {money(Math.abs(selected.budgetDifferenceCents))}
                    </p>
                  </div>
                ) : null}
                <details className="assumptions">
                  <summary>Como calculamos estes resultados</summary>
                  <ul>
                    {result.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </section>
        </section>
      </main>
      <footer>
        <span>HelpSystem Pro Viagens</span>
        <span>Planejar bem é parte da viagem.</span>
      </footer>
    </div>
  );
}
