import { useEffect, useRef, useState } from 'react';
import { Planner } from './Planner.js';
import { api, setCsrf, ApiError } from './api.js';
import type {
  SessionView,
  Trip,
  TripDetail,
  SavedScenario,
} from '../../../packages/contracts/src/persistence.js';
import type {
  SearchInput,
  Scenario,
} from '../../../packages/contracts/src/index.js';
const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value / 100,
  );
export function IdentityApp() {
  const [session, setSession] = useState<SessionView | null>(null),
    [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false),
    [plannerVersion, setPlannerVersion] = useState(0);
  const authDialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]),
    [active, setActive] = useState<TripDetail | null>(null);
  const [editing, setEditing] = useState<SavedScenario | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<SavedScenario[]>([]),
    [nextOffset, setNextOffset] = useState<number | null>(null);
  function signedOut() {
    setCsrf('');
    setSession(null);
    setTrips([]);
    setActive(null);
    setEditing(null);
    setComparison([]);
    setSelected([]);
    setNextOffset(null);
    setPlannerVersion((version) => version + 1);
    setShowAuth(false);
  }
  async function list(offset = 0) {
    const data = await api<{ trips: Trip[]; nextOffset: number | null }>(
      '/v1/trips?offset=' + offset,
    );
    setTrips((previous) =>
      offset ? [...previous, ...data.trips] : data.trips,
    );
    setNextOffset(data.nextOffset);
  }
  useEffect(() => {
    let disposed = false;
    const expire = () => {
      signedOut();
      setError('Sua sessão terminou. Entre novamente para continuar.');
    };
    window.addEventListener('viagens:session-expired', expire);
    void api<SessionView>('/v1/auth/session')
      .then(async (data) => {
        if (disposed) return;
        setCsrf(data.csrfToken);
        setSession(data);
        await list();
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setCsrf('');
          setSession(null);
          setError(
            error instanceof ApiError && error.status === 401
              ? ''
              : 'Não foi possível restaurar sua sessão. Verifique a conexão e tente entrar novamente.',
          );
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      window.removeEventListener('viagens:session-expired', expire);
    };
  }, []);
  useEffect(() => {
    if (showAuth && !session) authDialog.current?.showModal();
  }, [showAuth, session]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(
      () => {
        signedOut();
        setError('Sua sessão terminou. Entre novamente para continuar.');
      },
      Math.max(0, new Date(session.expiresAt).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [session]);
  async function authenticate(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'register') {
        const data = await api<{ message: string }>(
          '/v1/auth/register',
          'POST',
          { email, password },
        );
        setNotice(data.message);
        setMode('login');
        setPassword('');
      } else {
        const data = await api<SessionView>('/v1/auth/login', 'POST', {
          email,
          password,
        });
        setCsrf(data.csrfToken);
        setSession(data);
        setPassword('');
        setShowAuth(false);
        setNotice(
          'Seu planejamento continua abaixo. Salve quando estiver pronto.',
        );
        await list();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha de conexão.');
    } finally {
      setBusy(false);
    }
  }
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha de conexão.');
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    const trip = await api<TripDetail>('/v1/trips/' + id);
    setActive(trip);
    setEditing(null);
    setSelected([]);
    setComparison([]);
  }
  async function save(
    title: string,
    input: SearchInput,
    scenario: Scenario | null,
    scenarioTitle: string,
  ) {
    if (editing && !scenario)
      throw new Error(
        'Explore o mês e selecione uma data para atualizar o cenário.',
      );
    let id = active?.id;
    if (id) await api('/v1/trips/' + id, 'PATCH', { title, input });
    else {
      const trip = await api<TripDetail>('/v1/trips', 'POST', { title, input });
      id = trip.id;
      setActive(trip);
    }
    if (scenario)
      await api(
        '/v1/trips/' + id + '/scenarios' + (editing ? '/' + editing.id : ''),
        editing ? 'PATCH' : 'POST',
        { title: scenarioTitle, input, departure: scenario.departure },
      );
    await open(id);
    await list();
    setNotice('Viagem salva no seu espaço.');
  }
  function requestAccount(register = false) {
    setMode(register ? 'register' : 'login');
    setPassword('');
    setError('');
    setNotice('Seu planejamento continua aqui enquanto você entra.');
    setShowAuth(true);
  }
  const authentication = (
    <dialog
      ref={authDialog}
      className="auth-dialog"
      aria-labelledby="auth-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else {
          setShowAuth(false);
          setPassword('');
        }
      }}
    >
      <form className="auth-card" onSubmit={authenticate}>
        <p className="eyebrow">GUARDE SUAS POSSIBILIDADES</p>
        <h2 id="auth-title">
          {mode === 'login'
            ? 'Entre para salvar seus planos'
            : 'Crie seu espaço'}
        </h2>
        <p className="fine">
          Explore livremente. Com sua conta, salve viagens, compare cenários
          salvos e retome seus planos depois.
        </p>
        <fieldset disabled={busy}>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              required
              maxLength={254}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              required
              minLength={mode === 'register' ? 12 : 1}
              maxLength={128}
              autoComplete={
                mode === 'register' ? 'new-password' : 'current-password'
              }
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {mode === 'register' ? (
            <p className="fine">
              Use pelo menos 12 caracteres. Sua senha não será enviada por
              e-mail.
            </p>
          ) : null}
          <button className="primary" type="submit">
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setNotice('');
              setPassword('');
            }}
          >
            {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setShowAuth(false);
              setPassword('');
              setError('');
              setNotice('');
            }}
          >
            Continuar sem conta
          </button>
        </fieldset>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
      </form>
    </dialog>
  );
  return (
    <>
      {showAuth && !session ? authentication : null}
      {session ? (
        <section className="account-shell">
          <div className="account-toolbar">
            <div>
              <p className="eyebrow">SEU ESPAÇO DE VIAGENS</p>
              <span>{session.user.email}</span>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await api('/v1/auth/logout', 'POST');
                  signedOut();
                })
              }
            >
              Sair
            </button>
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="success" role="status">
              {notice}
            </p>
          ) : null}
          <div className="journey-heading">
            <h2>Minhas viagens</h2>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setActive(null);
                setEditing(null);
                setSelected([]);
                setComparison([]);
                setNotice('');
              }}
            >
              Nova viagem
            </button>
          </div>
          {trips.length === 0 ? (
            <p className="fine">
              Seu primeiro plano começa abaixo. Salve uma viagem para retomá-la
              depois.
            </p>
          ) : (
            <div className="journey-list">
              {trips.map((trip) => (
                <button
                  className={
                    active?.id === trip.id
                      ? 'journey-card chosen'
                      : 'journey-card'
                  }
                  key={trip.id}
                  disabled={busy}
                  onClick={() => void act(() => open(trip.id))}
                >
                  <strong>{trip.title}</strong>
                  <span>
                    {trip.input.origin} → {trip.input.destination}
                  </span>
                  <small>
                    {trip.input.month} · {trip.input.nights} noites
                  </small>
                </button>
              ))}
            </div>
          )}
          {nextOffset !== null ? (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void act(() => list(nextOffset))}
            >
              Carregar mais viagens
            </button>
          ) : null}
          {active ? (
            <section className="saved-journey">
              <div className="journey-heading">
                <h3>{active.title}</h3>
                <div className="inline-actions">
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        const trip = await api<Trip>(
                          '/v1/trips/' + active.id + '/duplicate',
                          'POST',
                        );
                        await open(trip.id);
                        await list();
                        setNotice('Cópia criada no seu espaço.');
                      })
                    }
                  >
                    Duplicar viagem
                  </button>
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm('Excluir esta viagem e seus cenários?')
                      )
                        void act(async () => {
                          await api('/v1/trips/' + active.id, 'DELETE');
                          setActive(null);
                          setEditing(null);
                          setComparison([]);
                          await list();
                        });
                    }}
                  >
                    Excluir viagem
                  </button>
                </div>
              </div>
              <p className="fine">
                Cenários salvos são snapshots DEMO. Compare até três; o Score v0
                mede adequação ao orçamento.
              </p>
              <div className="saved-scenarios">
                {active.scenarios.map((s) => (
                  <article className="scenario-card" key={s.id}>
                    <label className="scenario-choice">
                      <input
                        type="checkbox"
                        checked={selected.includes(s.id)}
                        disabled={
                          !selected.includes(s.id) && selected.length >= 3
                        }
                        onChange={(e) => {
                          setSelected(
                            e.target.checked
                              ? [...selected, s.id]
                              : selected.filter((id) => id !== s.id),
                          );
                          setComparison([]);
                        }}
                      />
                      Comparar {s.title}
                    </label>
                    <h3>{s.title}</h3>
                    <strong>{money(s.snapshot.costs.total)}</strong>
                    <p>
                      {s.snapshot.departure} → {s.snapshot.returnDate}
                    </p>
                    <small>DEMO · Score {s.snapshot.score}</small>
                    <div className="inline-actions">
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          setEditing(s);
                          setNotice(
                            'Edite os parâmetros abaixo; explore novamente ao mudar as datas.',
                          );
                        }}
                      >
                        Editar cenário
                      </button>
                      <button
                        className="text-button danger"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await api(
                              '/v1/trips/' + active.id + '/scenarios/' + s.id,
                              'DELETE',
                            );
                            await open(active.id);
                          })
                        }
                      >
                        Excluir cenário
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {active.scenarios.length === 0 ? (
                <p className="fine">
                  Explore o mês e salve uma data para criar seu primeiro
                  cenário.
                </p>
              ) : null}
              <button
                className="secondary"
                disabled={busy || selected.length === 0}
                onClick={() =>
                  void act(async () => {
                    const result = await api<{ scenarios: SavedScenario[] }>(
                      '/v1/trips/' + active.id + '/compare',
                      'POST',
                      { scenarioIds: selected },
                    );
                    setComparison(result.scenarios);
                  })
                }
              >
                Comparar selecionados ({selected.length}/3)
              </button>
              {comparison.length > 0 ? (
                <div
                  className="comparison"
                  role="region"
                  aria-label="Comparação de cenários"
                >
                  <table>
                    <caption>
                      Possibilidades para sua viagem · valores simulados
                    </caption>
                    <thead>
                      <tr>
                        <th>Componente</th>
                        {comparison.map((s) => (
                          <th key={s.id}>{s.title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ['flights', 'Passagens'],
                          ['hotels', 'Hospedagem'],
                          ['food', 'Alimentação'],
                          ['transport', 'Transporte'],
                          ['activities', 'Passeios'],
                          ['doorToDoor', 'Porta a porta'],
                          ['total', 'Total'],
                        ] as const
                      ).map(([key, label]) => (
                        <tr key={key}>
                          <th>{label}</th>
                          {comparison.map((s) => (
                            <td key={s.id}>{money(s.snapshot.costs[key])}</td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        <th>Score orçamento</th>
                        {comparison.map((s) => (
                          <td key={s.id}>{s.snapshot.score}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      ) : (
        <section
          className="account-shell guest-shell"
          aria-label="Acesso ao planejamento"
        >
          <div className="account-toolbar">
            <div>
              <strong>Explore sem cadastro</strong>
              <p className="fine">
                Encontre datas e custos livremente. Crie sua conta para salvar e
                gerenciar viagens.
              </p>
            </div>
            <div className="inline-actions">
              <button
                className="text-button"
                disabled={loading}
                onClick={() => requestAccount()}
              >
                Entrar
              </button>
              <button
                className="secondary"
                disabled={loading}
                onClick={() => requestAccount(true)}
              >
                Criar conta
              </button>
            </div>
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      )}
      <Planner
        key={
          plannerVersion +
          ':' +
          (active?.id ?? 'new') +
          ':' +
          (editing?.id ?? 'plan')
        }
        trip={active}
        editing={editing}
        onSave={save}
        signedIn={session !== null}
        accountLoading={loading}
        onRequireAccount={() => requestAccount()}
      />
    </>
  );
}
