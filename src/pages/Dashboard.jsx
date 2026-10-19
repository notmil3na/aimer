import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import Sidebar from "../components/Sidebar";
import ErrorBoundary from "../components/ErrorBoundary";
import NotificationBell from "../components/NotificationBell";
import SecuritySetupModal from "../components/SecuritySetupModal";
import useReminders from "../hooks/useReminders";
import { getMallaByCareer } from "../data/malla.js";
import { MALLA_SISTEMAS_2022, aplicaPlan2022 } from "../data/malla2022.js";
import { api, getSessionData, updateSessionData } from "../api";
import { getPendingSaves, hasPendingSaves, queueSave, clearPendingSave } from "../utils/offlineQueue.js";
import styles from "./Dashboard.module.css";
import {
  IconSchedule, IconCalendar, IconClipboard, IconSemester,
  IconGrades, IconMalla, IconSettings, IconUsers, IconChat,
  IconCheck
} from "../components/Icons";

function loadView(loader) {
  return loader().catch(() => {
    return new Promise((resolve, reject) => {
      setTimeout(() => loader().then(resolve).catch(reject), 1200);
    });
  });
}

const VIEW_LOADERS = {
  malla:        () => import("../components/MallaView"),
  cursando:     () => import("../components/CursandoView"),
  horario:      () => import("../components/HorarioView"),
  notas:        () => import("../components/NotasView"),
  config:       () => import("../components/SettingsView"),
  calendario:   () => import("../components/CalendarioView"),
  asignaciones: () => import("../components/AsignacionesView"),
  colaboracion: () => import("../components/ColaboracionView"),
  chat:         () => import("../components/ChatView"),
};

const MallaView = lazy(() => loadView(VIEW_LOADERS.malla));
const CursandoView = lazy(() => loadView(VIEW_LOADERS.cursando));
const HorarioView = lazy(() => loadView(VIEW_LOADERS.horario));
const NotasView = lazy(() => loadView(VIEW_LOADERS.notas));
const SettingsView = lazy(() => loadView(VIEW_LOADERS.config));
const CalendarioView = lazy(() => loadView(VIEW_LOADERS.calendario));
const AsignacionesView = lazy(() => loadView(VIEW_LOADERS.asignaciones));
const ColaboracionView = lazy(() => loadView(VIEW_LOADERS.colaboracion));
const ChatView = lazy(() => loadView(VIEW_LOADERS.chat));

function autoApply(malla, currentSemester) {
  return malla.map((sem) => ({
    ...sem,
    materias: sem.materias.map((m) => {
      if (typeof sem.semestre !== "number") return m;
      if (sem.semestre < currentSemester && m.estado === "faltante")
        return { ...m, estado: "aprobada" };
      if (sem.semestre === currentSemester && m.estado === "faltante")
        return { ...m, estado: "cursando" };
      return m;
    }),
  }));
}

function mergeMallaWithBase(baseMalla, savedMalla) {
  if (!savedMalla) return baseMalla;
  const savedById = new Map(
    savedMalla.flatMap((sem) => sem.materias).map((m) => [m.id, m])
  );
  return baseMalla.map((sem) => ({
    ...sem,
    materias: sem.materias.map((baseMat) => {
      const savedMat = savedById.get(baseMat.id);
      return savedMat
        ? { ...baseMat, estado: savedMat.estado ?? baseMat.estado }
        : baseMat;
    }),
  }));
}

async function loadUserData() {
  try {
    const { data } = await api("/user_data");
    return data || null;
  } catch {
    return null;
  }
}

async function saveUserData(patch) {
  try {
    await api("/user_data", { method: "POST", body: { patch } });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export default function Dashboard({ user, onLogout, onUpdateUser }) {
  const [tab, setTab] = useState(() => {
    try {
      const key = `malla_tutorial_v2_${user.username}`;
      if (!localStorage.getItem(key)) return "config";
    } catch (_) {}
    return "horario";
  });
  const cachedRef = useRef(null);
  if (cachedRef.current === null) cachedRef.current = getSessionData();
  const cached = cachedRef.current;
  const [loaded, setLoaded] = useState(!!cached);
  const [toastMsg, setToastMsg] = useState("");
  const [toastAction, setToastAction] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [pendingCount, setPendingCount] = useState(() =>
    typeof localStorage !== "undefined" && hasPendingSaves()
      ? Object.keys(getPendingSaves()).length
      : 0
  );
  const toastTimerRef = useRef(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      const key = `malla_onboarding_done_${user.username}`;
      return !localStorage.getItem(key);
    } catch (_) { return false; }
  });

  const [onboardingChecked, setOnboardingChecked] = useState(() => {
    try {
      const raw = localStorage.getItem(`malla_onboarding_checks_${user.username}`);
      return raw ? JSON.parse(raw) : { perfil: false, malla: false, horario: false };
    } catch (_) { return { perfil: false, malla: false, horario: false }; }
  });

  const onboardingRef = useRef(null);
  const toggleOnboardingCheck = useCallback((key) => {
    setOnboardingChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(`malla_onboarding_checks_${user.username}`, JSON.stringify(next)); } catch (_) {}
      return next;
    });
  }, [user.username]);

  const allOnboardingDone = onboardingChecked.perfil && onboardingChecked.malla && onboardingChecked.horario;
  const onboardingPercent = ((Object.values(onboardingChecked).filter(Boolean).length) / 3) * 100;

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(`malla_onboarding_done_${user.username}`, "1");
      localStorage.setItem(`malla_tutorial_v2_${user.username}`, "1");
    } catch (_) {}
  }, [user.username]);

  useEffect(() => {
    if (showOnboarding && allOnboardingDone) dismissOnboarding();
  }, [showOnboarding, allOnboardingDone, dismissOnboarding]);

  const ONBOARDING_STEPS = [
    { key: "perfil",  label: "Completa tu perfil",          desc: "Universidad, carrera y semestre",    tab: "config",   icon: <IconSettings size={16} /> },
    { key: "malla",   label: "Marca tus materias",           desc: "Estado de cada materia en la malla", tab: "malla",   icon: <IconMalla size={16} /> },
    { key: "horario", label: "Arma tu primer horario",       desc: "Arrastra materias al horario",       tab: "horario",  icon: <IconSchedule size={16} /> },
  ];

  const notify = useCallback((msg, options) => {
    setToastMsg(msg);
    setToastAction(options?.onUndo || null);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg("");
      setToastAction(null);
    }, options?.duration || 4000);
  }, []);

  const baseMalla = useMemo(() => getMallaByCareer(user.career), [user.career]);
  const defaultMalla = useMemo(() => autoApply(baseMalla, user.semester || 1), [baseMalla, user.semester]);

  // Plan 2022-1: solo para quienes ingresaron en ese corte en Ingeniería de
  // Sistemas. Llega a la malla como vista previa; su malla guardada no cambia.
  const planAlternativo = useMemo(
    () => (aplicaPlan2022(user)
      ? { label: "plan 2022-1", malla: MALLA_SISTEMAS_2022 }
      : null),
    [user.career, user.ingresoCorte]
  );

  const [malla, setMalla] = useState(() => (cached?.malla ? mergeMallaWithBase(defaultMalla, cached.malla) : defaultMalla));
  const [notas, setNotas] = useState(cached?.notas ?? {});
  const [cursandoData, setCursandoData] = useState(cached?.cursando ?? {});
  const [horarioData, setHorarioData] = useState(cached?.horario ?? { dias: ["L", "M", "X", "J", "V"], clases: [] });
  const [planData, setPlanData] = useState(cached?.plan ?? null);
  const [calendarioData, setCalendarioData] = useState(cached?.calendario ?? { eventos: [] });
  const [asignacionesData, setAsignacionesData] = useState(cached?.asignaciones ?? { items: [] });
  const [notasClaseData, setNotasClaseData] = useState(cached?.notasclase ?? {});

  const persistColumn = useCallback(async (column, data, applyLocal) => {
    applyLocal(data);
    updateSessionData({ [column]: data });
    if (!navigator.onLine) {
      queueSave(column, data);
      setPendingCount(Object.keys(getPendingSaves()).length);
      notify("Sin conexión: tus cambios quedaron guardados y se sincronizarán al volver.");
      return;
    }
    const res = await saveUserData({ [column]: data });
    if (!res.ok) {
      queueSave(column, data);
      setPendingCount(Object.keys(getPendingSaves()).length);
      notify("Sin conexión: tus cambios quedaron guardados y se sincronizarán al volver.");
    } else {
      notify("Cambios guardados");
    }
  }, [user.username, notify]);

  useEffect(() => {
    const flush = async () => {
      const pending = getPendingSaves();
      const cols = Object.keys(pending);
      if (cols.length === 0) return;
      let okCount = 0;
      for (const col of cols) {
        const res = await saveUserData({ [col]: pending[col] });
        if (res.ok) {
          clearPendingSave(col);
          okCount++;
        }
      }
      setPendingCount(Object.keys(getPendingSaves()).length);
      if (okCount > 0) notify(`${okCount} cambio(s) sincronizado(s) con la nube`);
    };

    const onOnline = () => { setIsOffline(false); flush(); };
    const onOffline = () => { setIsOffline(true); };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine && hasPendingSaves()) flush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user.username, notify]);

  useEffect(() => {
    const schedule = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 250));
    schedule(() => {
      Object.values(VIEW_LOADERS).forEach((loader) => loader().catch(() => {}));
    });
  }, []);

  useEffect(() => {
    async function load() {
      const data = await loadUserData();
      if (data) {
        updateSessionData({
          ...(data.malla && { malla: data.malla }),
          ...(data.notas && { notas: data.notas }),
          ...(data.cursando && { cursando: data.cursando }),
          ...(data.horario && { horario: data.horario }),
          ...(data.plan && { plan: data.plan }),
          ...(data.calendario && { calendario: data.calendario }),
          ...(data.asignaciones && { asignaciones: data.asignaciones }),
          ...(data.notasclase && { notasclase: data.notasclase }),
        });
        if (data.malla) setMalla(mergeMallaWithBase(defaultMalla, data.malla));
        if (data.notas) setNotas(data.notas);
        if (data.cursando) setCursandoData(data.cursando);
        if (data.horario) setHorarioData(data.horario);
        if (data.plan) setPlanData(data.plan);
        if (data.calendario) setCalendarioData(data.calendario);
        if (data.asignaciones) setAsignacionesData(data.asignaciones);
        if (data.notasclase) setNotasClaseData(data.notasclase);
      }
      setLoaded(true);
    }
    load();
  }, [user.username]);

  const saveMalla = useCallback(async (data) => {
    await persistColumn("malla", data, setMalla);
  }, [persistColumn]);

  const saveNotas = useCallback(async (data) => {
    await persistColumn("notas", data, setNotas);
  }, [persistColumn]);

  const saveCursando = useCallback(async (data) => {
    await persistColumn("cursando", data, setCursandoData);
  }, [persistColumn]);

  const saveHorario = useCallback(async (data) => {
    await persistColumn("horario", data, setHorarioData);
  }, [persistColumn]);

  const savePlan = useCallback(async (data) => {
    await persistColumn("plan", data, setPlanData);
  }, [persistColumn]);

  const saveCalendario = useCallback(async (data) => {
    await persistColumn("calendario", data, setCalendarioData);
  }, [persistColumn]);

  const saveAsignaciones = useCallback(async (data) => {
    await persistColumn("asignaciones", data, setAsignacionesData);
  }, [persistColumn]);

  const saveNotasClase = useCallback(async (data) => {
    await persistColumn("notasclase", data, setNotasClaseData);
  }, [persistColumn]);

  const saveSemestre = useCallback((semestre) => {
    saveCalendario({ ...calendarioData, semestre });
  }, [saveCalendario, calendarioData]);

  const semestre = calendarioData?.semestre || null;

  const reminders = useReminders({
    items: asignacionesData?.items || [],
    eventos: calendarioData?.eventos || [],
  });

  const handleMallaReset = useCallback((newSemester) => {
    const reset = autoApply(baseMalla, newSemester);
    persistColumn("malla", reset, setMalla);
    notify("Semestre reiniciado");
  }, [baseMalla, persistColumn, notify]);

  const enrollMateriasFromPlan = useCallback((materiaIds) => {
    const idSet = new Set(materiaIds);
    let updated;
    setMalla(prev => {
      updated = prev.map((sem) => ({
        ...sem,
        materias: sem.materias.map((m) => {
          if (idSet.has(m.id)) return { ...m, estado: "cursando" };
          if (m.estado === "cursando") return { ...m, estado: "faltante" };
          return m;
        }),
      }));
      return updated;
    });
    if (updated) persistColumn("malla", updated, setMalla);
  }, [persistColumn, notify]);

  const tabs = useMemo(() => [
    { id: "horario", label: "Horario", icon: IconSchedule },
    { id: "asignaciones", label: "Asignaciones", icon: IconClipboard },
    { id: "cursando", label: "Semestre", icon: IconSemester },
    { id: "calendario", label: "Calendario", icon: IconCalendar },
    { id: "notas", label: "Notas", icon: IconGrades },
    { id: "malla", label: "Malla", icon: IconMalla },
    { id: "colaboracion", label: "Amigos", icon: IconUsers },
    { id: "chat", label: "Chats", icon: IconChat },
    { id: "config", label: "Configuración", icon: IconSettings },
  ], []);

  return (
    <div className={styles.layout}>
      <Sidebar
        user={user}
        tabs={tabs}
        activeTab={tab}
        onTabChange={setTab}
        onLogout={onLogout}
        onUpdateUser={onUpdateUser}
        bell={<NotificationBell {...reminders} />}
      />
      <main className={`${styles.main}${tab === "chat" ? ` ${styles.mainChat}` : ""}`}>
        {showOnboarding && (
          <div className={styles.onboardingBar} ref={onboardingRef}>
            <div className={styles.onboardingCard}>
              <div className={styles.onboardingHeader}>
                <div className={styles.onboardingHeaderLeft}>
                  <span className={styles.onboardingTitle}>Primeros pasos</span>
                  <span className={styles.onboardingSubtitle}>{Math.round(onboardingPercent)}% completado</span>
                </div>
                {allOnboardingDone ? (
                  <button className={styles.onboardingDismiss} onClick={dismissOnboarding}>
                    <IconCheck size={14} /> ¡Listo!
                  </button>
                ) : (
                  <button className={styles.onboardingDismiss} onClick={dismissOnboarding}>Omitir</button>
                )}
              </div>
              <div className={styles.onboardingProgress}>
                <div className={styles.onboardingProgressBar} style={{ width: `${onboardingPercent}%` }} />
              </div>
              <div className={styles.onboardingSteps}>
                {ONBOARDING_STEPS.map(step => {
                  const done = onboardingChecked[step.key];
                  return (
                    <div key={step.key} className={styles.onboardingStep}>
                      <button
                        className={`${styles.onboardingCheck} ${done ? styles.onboardingCheckDone : ""}`}
                        onClick={() => toggleOnboardingCheck(step.key)}
                        aria-label={done ? `Marcar "${step.label}" como pendiente` : `Marcar "${step.label}" como hecho`}
                      >
                        {done && <IconCheck size={12} />}
                      </button>
                      <div className={styles.onboardingStepContent}>
                        <button
                          className={`${styles.onboardingStepLabel} ${done ? styles.onboardingStepDone : ""}`}
                          onClick={() => setTab(step.tab)}
                        >
                          {step.icon}
                          <span>{step.label}</span>
                        </button>
                        <span className={styles.onboardingStepDesc}>{step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <ErrorBoundary key={tab} view>
          <Suspense fallback={
            <div className={styles.tabLoading}>
              <span style={{ fontSize: "20px", color: "var(--accent)" }}>✦</span>
              <span>Cargando...</span>
            </div>
          }>
            {tab === "horario" && (
              <HorarioView
                  malla={malla}
                  horarioData={horarioData}
                  planData={planData}
                  onSave={saveHorario}
                  onSavePlan={savePlan}
                  onNotify={notify}
                  user={user}
                  onEnrollMaterias={enrollMateriasFromPlan}
                />
            )}
            {tab === "calendario" && (
              <CalendarioView
                malla={malla}
                calendarioData={calendarioData}
                onSave={saveCalendario}
                user={user}
                horarioData={horarioData}
                asignacionesData={asignacionesData}
                onSaveAsignaciones={saveAsignaciones}
              />
            )}
            {tab === "asignaciones" && (
              <AsignacionesView
                malla={malla}
                asignacionesData={asignacionesData}
                onSave={saveAsignaciones}
                user={user}
                cursandoData={cursandoData}
                onSaveCursando={saveCursando}
                calendarioData={calendarioData}
                onSaveCalendario={saveCalendario}
                semestre={semestre}
              />
            )}
            {tab === "cursando" && (
              <CursandoView
                malla={malla}
                cursandoData={cursandoData}
                onSave={saveCursando}
                user={user}
                horarioData={horarioData}
                notasClaseData={notasClaseData}
                onSaveNotasClase={saveNotasClase}
              />
            )}
            {tab === "malla" && (
              <MallaView
                malla={malla}
                notas={notas}
                onSave={saveMalla}
                user={user}
                onNotify={notify}
                semestre={semestre}
                planAlternativo={planAlternativo}
              />
            )}
            {tab === "notas" && (
              <NotasView malla={malla} notas={notas} onSave={saveNotas} user={user} />
            )}
            {tab === "config" && (
              <SettingsView
                user={user}
                onUpdate={onUpdateUser}
                onMallaReset={handleMallaReset}
                malla={malla}
                semestre={semestre}
                onSaveSemestre={saveSemestre}
              />
            )}
            {tab === "colaboracion" && (
              <ColaboracionView
                user={user}
                malla={malla}
                horarioData={horarioData}
                onNotify={notify}
                notas={notas}
                cursandoData={cursandoData}
                notasClaseData={notasClaseData}
                asignacionesData={asignacionesData}
                semestre={semestre}
              />
            )}
            {tab === "chat" && (
              <ChatView
                user={user}
                malla={malla}
                notasClaseData={notasClaseData}
                asignacionesData={asignacionesData}
                onSaveAsignaciones={saveAsignaciones}
                onSaveNotasClase={saveNotasClase}
                onNotify={notify}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {!loaded && (
        <div className={styles.syncing}>
          <span className={styles.syncingDot} />
          Sincronizando tu información…
        </div>
      )}
      {toastMsg && (
        <div className={styles.toast}>
          <span>{toastMsg}</span>
          {toastAction && (
            <button className={styles.toastUndo} onClick={() => {
              toastAction();
              window.clearTimeout(toastTimerRef.current);
              setToastMsg("");
              setToastAction(null);
            }}>Deshacer</button>
          )}
        </div>
      )}
      <SecuritySetupModal />
      {(isOffline || pendingCount > 0) && (
        <div className={styles.offlineBar}>
          <span className={styles.offlineDot} />
          {isOffline
            ? "Sin conexión · tus cambios se guardan en este dispositivo"
            : `${pendingCount} cambio(s) por sincronizar`}
        </div>
      )}
    </div>
  );
}
