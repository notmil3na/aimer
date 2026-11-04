import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from "react";
import Sidebar from "./Sidebar";
import ErrorBoundary from "../components/ErrorBoundary";
import NotificationBell from "../components/NotificationBell";
import SecuritySetupModal from "../components/SecuritySetupModal";
import LoadingScreen from "../components/LoadingScreen";
import useGlobalSiteText from "../hooks/useGlobalSiteText";
import useReminders from "../hooks/useReminders";
import useMediaQuery from "../hooks/useMediaQuery";
import { getMallaByCareer } from "../data/malla.js";
import { MALLA_SISTEMAS_2022, aplicaPlan2022, claveEstado, traducirDatosGuardados } from "../data/malla2022.js";
import { api, getSessionData, updateSessionData } from "../api";
import { DEMO_USER_DATA, cloneDemoData } from "../demoData.js";
import { getPendingSaves, hasPendingSaves, queueSave, clearPendingSave, getPendingEntries } from "../utils/offlineQueue.js";
import { mergeUserData, mergeColumnData } from "../utils/dataMerge.js";
import styles from "./Dashboard.module.css";
import {
  IconSchedule, IconClipboard, IconSemester,
  IconMalla, IconSettings, IconUsers, IconChat,
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
  config:        () => import("../components/SettingsView"),
  asignaciones: () => import("../components/AsignacionesView"),
  colaboracion: () => import("../components/ColaboracionView"),
  chat:         () => import("../components/ChatView"),
};

const MallaView = lazy(() => loadView(VIEW_LOADERS.malla));
const CursandoView = lazy(() => loadView(VIEW_LOADERS.cursando));
const HorarioView = lazy(() => loadView(VIEW_LOADERS.horario));
const SettingsView = lazy(() => loadView(VIEW_LOADERS.config));
const AsignacionesView = lazy(() => loadView(VIEW_LOADERS.asignaciones));
const ColaboracionView = lazy(() => loadView(VIEW_LOADERS.colaboracion));
const ChatView = lazy(() => loadView(VIEW_LOADERS.chat));
const AdminView = lazy(() => import("../components/AdminView"));

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

function mergeMallaWithBase(baseMalla, savedMalla, porNombre = false) {
  if (!savedMalla) return baseMalla;
  const clave = (m) => (porNombre ? claveEstado(m.nombre) : m.id);
  const savedById = new Map(
    savedMalla.flatMap((sem) => sem.materias).map((m) => [clave(m), m])
  );
  return baseMalla.map((sem) => ({
    ...sem,
    materias: sem.materias.map((baseMat) => {
      const savedMat = savedById.get(clave(baseMat));
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

async function saveUserData(patch, baseVersion) {
  try {
    const res = await api("/user_data", {
      method: "POST",
      body: { patch, baseVersion: baseVersion ?? undefined },
    });
    return { ok: true, version: res.version, updatedAt: res.updated_at };
  } catch (error) {
    return {
      ok: false,
      error,
      status: error.status,
      serverData: error.serverData,
      serverVersion: error.serverVersion,
    };
  }
}

function hasCompletedTutorial(username) {
  try {
    return Boolean(
      localStorage.getItem(`malla_onboarding_done_${username}`) ||
      localStorage.getItem(`malla_tutorial_v2_${username}`)
    );
  } catch (_) {
    return false;
  }
}

export default function Dashboard({ user, onLogout, onUpdateUser, appBooting = false, demoMode = false }) {
  const siteTextRootRef = useRef(null);
  const [adminMode, setAdminMode] = useState(false);
  const [tab, setTab] = useState(() => {
    if (demoMode) return "horario";
    try {
      const key = `malla_tutorial_v2_${user.username}`;
      if (!localStorage.getItem(key)) return "config";
    } catch (_) {}
    return "horario";
  });
  useGlobalSiteText(`dashboard:${tab}`, siteTextRootRef);
  const isPhone = useMediaQuery("(max-width: 800px)");
  const cachedRef = useRef(null);
  if (cachedRef.current === null) cachedRef.current = demoMode ? cloneDemoData(DEMO_USER_DATA) : getSessionData();
  const cached = cachedRef.current;
  const dataVersionRef = useRef(cached?.version || 1);
  const [loaded, setLoaded] = useState(!!cached);
  const [showSyncLoading, setShowSyncLoading] = useState(!cached);
  const finishSyncLoading = useCallback(() => setShowSyncLoading(false), []);
  const [toastMsg, setToastMsg] = useState("");
  const [toastAction, setToastAction] = useState(null);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [pendingCount, setPendingCount] = useState(() =>
    typeof localStorage !== "undefined" && hasPendingSaves(user.username)
      ? Object.keys(getPendingSaves(user.username)).length
      : 0
  );
  const toastTimerRef = useRef(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !demoMode && !hasCompletedTutorial(user.username));

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

  // Plan 2022-1: para quienes ingresaron en ese corte en Ingeniería de Sistemas
  // es su plan (se edita y se guarda como cualquier malla). El plan actual, el
  // que aplica a todos, queda disponible como vista previa.
  const esPlan2022 = useMemo(() => aplicaPlan2022(user), [user.career, user.ingresoCorte]);
  const baseMalla = useMemo(
    () => (esPlan2022 ? MALLA_SISTEMAS_2022 : getMallaByCareer(user.career)),
    [esPlan2022, user.career]
  );
  const planAlternativo = useMemo(
    () => (esPlan2022
      ? { label: "plan actual", titulo: "Plan actual", slug: "plan-actual", malla: getMallaByCareer(user.career) }
      : null),
    [esPlan2022, user.career]
  );

  // Los datos guardados vienen con los ids del plan actual; para quien pasa al
  // plan 2022-1 se traducen por materia equivalente (notas, cursando, horario...).
  const guardado = useMemo(
    () => (esPlan2022 ? traducirDatosGuardados(cached) : cached),
    [esPlan2022, cached]
  );

  // El auto-aprobado (todo aprobado hasta el semestre actual) es sólo el punto
  // de partida de una cuenta que todavía no tiene malla guardada. En cuanto hay
  // malla guardada mandan los estados que el usuario tenga configurados, sin
  // volver a aplicar la regla.
  const [hayMallaGuardada, setHayMallaGuardada] = useState(!!guardado?.malla);
  const [malla, setMalla] = useState(() =>
    guardado?.malla
      ? mergeMallaWithBase(baseMalla, guardado.malla, esPlan2022)
      : autoApply(baseMalla, user.semester || 1)
  );

  useEffect(() => {
    // Sin malla guardada, el semestre actual es el que define el punto de
    // partida; en cuanto el usuario guarda algo, esto ya no se aplica.
    // Solo auto-aplicar si ya cargaron los datos (loaded) y efectivamente no hay malla guardada,
    // para evitar pisar la malla del servidor antes de que termine load() en un nuevo dispositivo.
    if (loaded && !hayMallaGuardada) {
      setMalla(autoApply(baseMalla, user.semester || 1));
    }
  }, [loaded, hayMallaGuardada, baseMalla, user.semester]);

  const [notas, setNotas] = useState(guardado?.notas ?? {});
  const [cursandoData, setCursandoData] = useState(guardado?.cursando ?? {});
  const [horarioData, setHorarioData] = useState(guardado?.horario ?? { dias: ["L", "M", "X", "J", "V"], clases: [] });
  const [planData, setPlanData] = useState(guardado?.plan ?? null);
  const [calendarioData, setCalendarioData] = useState(guardado?.calendario ?? { eventos: [] });
  const [asignacionesData, setAsignacionesData] = useState(guardado?.asignaciones ?? { items: [] });
  const [notasClaseData, setNotasClaseData] = useState(guardado?.notasclase ?? {});

  const persistColumn = useCallback(async (column, data, applyLocal) => {
    applyLocal(data);
    if (column === "malla") setHayMallaGuardada(true);
    if (demoMode) {
      await saveUserData({ [column]: data }, dataVersionRef.current);
      notify("Cambios guardados solo en esta demostración");
      return;
    }
    updateSessionData({ [column]: data });

    if (!navigator.onLine) {
      queueSave(column, data, dataVersionRef.current, user.username);
      setPendingCount(Object.keys(getPendingSaves(user.username)).length);
      notify("Sin conexión: tus cambios quedaron guardados y se sincronizarán al volver.");
      return;
    }

    const res = await saveUserData({ [column]: data }, dataVersionRef.current);
    if (res.ok) {
      if (res.version) dataVersionRef.current = res.version;
      updateSessionData({ version: dataVersionRef.current, updated_at: res.updatedAt });
      notify("Cambios guardados");
      return;
    }

    // Si hubo conflicto de concurrencia (409) porque otro dispositivo guardó:
    if (res.status === 409 && res.serverData) {
      const serverVal = res.serverData[column];
      const merged = mergeColumnData(column, serverVal, data);
      applyLocal(merged);
      if (res.serverVersion) dataVersionRef.current = res.serverVersion;
      updateSessionData({ [column]: merged, version: dataVersionRef.current });

      // Reintentar guardar los datos fusionados con la versión más reciente del servidor
      const retryRes = await saveUserData({ [column]: merged }, res.serverVersion);
      if (retryRes.ok) {
        if (retryRes.version) dataVersionRef.current = retryRes.version;
        updateSessionData({ version: dataVersionRef.current, updated_at: retryRes.updatedAt });
        notify("Tus cambios se combinaron con los de tu otro dispositivo.");
      } else {
        queueSave(column, merged, dataVersionRef.current, user.username);
        setPendingCount(Object.keys(getPendingSaves(user.username)).length);
        notify("Hubo un conflicto y los cambios se guardaron para reintentar.");
      }
      return;
    }

    // Otro error de red o servidor: guardar en cola offline
    queueSave(column, data, dataVersionRef.current, user.username);
    setPendingCount(Object.keys(getPendingSaves(user.username)).length);
    notify("Sin conexión: tus cambios quedaron guardados y se sincronizarán al volver.");
  }, [user.username, notify, demoMode]);

  useEffect(() => {
    const flush = async () => {
      const pendingEntries = getPendingEntries(user.username);
      const cols = Object.keys(pendingEntries);
      if (cols.length === 0) return;
      let okCount = 0;

      for (const col of cols) {
        const meta = pendingEntries[col];
        const patchData = meta && typeof meta === "object" && "data" in meta ? meta.data : meta;
        const baseVer = (meta && meta.baseVersion) || dataVersionRef.current;

        const res = await saveUserData({ [col]: patchData }, baseVer);
        if (res.ok) {
          if (res.version) dataVersionRef.current = res.version;
          clearPendingSave(col, user.username);
          okCount++;
        } else if (res.status === 409 && res.serverData) {
          // Si otro dispositivo modificó mientras estábamos offline: fusionar por ítems/clave
          const merged = mergeColumnData(col, res.serverData[col], patchData);
          const retryRes = await saveUserData({ [col]: merged }, res.serverVersion);
          if (retryRes.ok) {
            if (retryRes.version) dataVersionRef.current = retryRes.version;
            clearPendingSave(col, user.username);
            okCount++;
            // Actualizar vista local
            if (col === "horario") setHorarioData(merged);
            else if (col === "asignaciones") setAsignacionesData(merged);
            else if (col === "calendario") setCalendarioData(merged);
            else if (col === "cursando") setCursandoData(merged);
            else if (col === "notas") setNotas(merged);
            else if (col === "notasclase") setNotasClaseData(merged);
            else if (col === "plan") setPlanData(merged);
            else if (col === "malla") setMalla(mergeMallaWithBase(baseMalla, merged, esPlan2022));
            updateSessionData({ [col]: merged, version: dataVersionRef.current });
          }
        }
      }
      setPendingCount(Object.keys(getPendingSaves(user.username)).length);
      if (okCount > 0) notify(`${okCount} cambio(s) sincronizado(s) con la nube`);
    };

    if (demoMode) return undefined;
    const onOnline = () => { setIsOffline(false); flush(); };
    const onOffline = () => { setIsOffline(true); };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (navigator.onLine && hasPendingSaves(user.username)) flush();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [user.username, notify, baseMalla, esPlan2022, demoMode]);

  useEffect(() => {
    async function load() {
      const data = await loadUserData();
      if (data?.version) {
        dataVersionRef.current = data.version;
      }
      // Reconciliar con lo que quedó pendiente sin pisar columnas completas del servidor
      const pendientes = getPendingSaves(user.username);
      const combinado = (data || Object.keys(pendientes).length)
        ? mergeUserData(data, pendientes)
        : null;
      const guardadoApi = combinado ? (esPlan2022 ? traducirDatosGuardados(combinado) : combinado) : null;
      if (guardadoApi) {
        updateSessionData({
          ...(guardadoApi.malla && { malla: guardadoApi.malla }),
          ...(guardadoApi.notas && { notas: guardadoApi.notas }),
          ...(guardadoApi.cursando && { cursando: guardadoApi.cursando }),
          ...(guardadoApi.horario && { horario: guardadoApi.horario }),
          ...(guardadoApi.plan && { plan: guardadoApi.plan }),
          ...(guardadoApi.calendario && { calendario: guardadoApi.calendario }),
          ...(guardadoApi.asignaciones && { asignaciones: guardadoApi.asignaciones }),
          ...(guardadoApi.notasclase && { notasclase: guardadoApi.notasclase }),
          version: dataVersionRef.current,
        });
        if (guardadoApi.malla) {
          setHayMallaGuardada(true);
          setMalla(mergeMallaWithBase(baseMalla, guardadoApi.malla, esPlan2022));
        }
        if (guardadoApi.notas) setNotas(guardadoApi.notas);
        if (guardadoApi.cursando) setCursandoData(guardadoApi.cursando);
        if (guardadoApi.horario) setHorarioData(guardadoApi.horario);
        if (guardadoApi.plan) setPlanData(guardadoApi.plan);
        if (guardadoApi.calendario) setCalendarioData(guardadoApi.calendario);
        if (guardadoApi.asignaciones) setAsignacionesData(guardadoApi.asignaciones);
        if (guardadoApi.notasclase) setNotasClaseData(guardadoApi.notasclase);
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
  }, !demoMode);

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

  const allTabs = useMemo(() => [
    { id: "horario", label: "Horario", icon: IconSchedule },
    { id: "asignaciones", label: "Asignaciones", icon: IconClipboard },
    { id: "cursando", label: "Semestre", icon: IconSemester },
    { id: "malla", label: "Malla", icon: IconMalla },
    { id: "colaboracion", label: "Amigos", icon: IconUsers },
    { id: "chat", label: "Chats", icon: IconChat },
    { id: "config", label: "Configuración", icon: IconSettings },
    ...(adminMode && user.isAdmin ? [{ id: "admin", label: "Administrar", icon: IconSettings }] : []),
  ], [adminMode, user.isAdmin]);

  // En el teléfono Amigos y Chats son una sola vista: Chats es la principal y
  // los amigos se abren desde el icono de la cabecera.
  const tabs = useMemo(
    () => (isPhone ? allTabs.filter((t) => t.id !== "colaboracion") : allTabs),
    [allTabs, isPhone]
  );
  const toggleAdminMode = () => {
    if (adminMode && tab === "admin") setTab("horario");
    setAdminMode(!adminMode);
  };

  useEffect(() => {
    if (isPhone && tab === "colaboracion") setTab("chat");
  }, [isPhone, tab]);
  useEffect(() => {
    if (tab === "calendario") setTab("asignaciones");
  }, [tab]);

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
        hideTopBar={tab === "chat"}
      />
      <main
        ref={siteTextRootRef}
        data-site-text-scope={`dashboard:${tab}`}
        className={`${styles.main}${tab === "chat" ? ` ${styles.mainChat}` : ""}`}
      >
        {demoMode && (
          <div className={styles.demoNotice} role="note">
            Vista de demostración · Perfil y datos ficticios; los cambios no se guardan en una cuenta real.
          </div>
        )}
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
              <span style={{ fontSize: "20px", color: "var(--accent-text)" }}>✦</span>
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
                notas={notas}
                onSaveNotas={saveNotas}
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
                etiquetaPlan={esPlan2022 ? "Plan 2022-1" : null}
              />
            )}
            {tab === "config" && (
              <SettingsView
                user={user}
                onUpdate={onUpdateUser}
                onLogout={onLogout}
                malla={malla}
                semestre={semestre}
                onSaveSemestre={saveSemestre}
                adminMode={adminMode}
                onToggleAdminMode={toggleAdminMode}
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
                horarioData={horarioData}
                notasClaseData={notasClaseData}
                asignacionesData={asignacionesData}
                onSaveAsignaciones={saveAsignaciones}
                onSaveNotasClase={saveNotasClase}
                onNotify={notify}
              />
            )}
            {tab === "admin" && adminMode && user.isAdmin && <AdminView />}
          </Suspense>
        </ErrorBoundary>
      </main>

      {showSyncLoading && !appBooting && (
        <LoadingScreen
          ready={loaded}
          label="Sincronizando tu información"
          onDone={finishSyncLoading}
        />
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
      <SecuritySetupModal disabled={demoMode} />
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
