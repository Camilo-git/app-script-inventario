import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { GuardarElementoInput } from '../hooks/useInventoryStore';
import {
  CategoriaElemento,
  Elemento,
  EstadoFisico,
  Novedad,
} from '../types/inventory';
import {
  calcularUnidadesAfueraPorNovedad,
  calcularUnidadesDisponibles,
  exportarCsvDescarga,
} from '../utils/inventoryRules';

interface CatalogoViewProps {
  elementos: Elemento[];
  novedades: Novedad[];
  soloConsulta: boolean;
  onGuardarElemento: (input: GuardarElementoInput) => boolean;
}

export const CatalogoView: React.FC<CatalogoViewProps> = ({
  elementos,
  novedades,
  soloConsulta,
  onGuardarElemento,
}) => {
  const [filtroCat, setFiltroCat] = useState<'todos' | CategoriaElemento>('todos');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | undefined>(undefined);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState<CategoriaElemento>(CategoriaElemento.Audiovisual);
  const [tipo, setTipo] = useState('Portátil');
  const [estadoFisico, setEstadoFisico] = useState<EstadoFisico>('Óptimo');
  const [cantidadTotal, setCantidadTotal] = useState(1);
  const [ubicacion, setUbicacion] = useState('Estante A1');
  const [activo, setActivo] = useState(true);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return elementos.filter((el) => {
      if (!mostrarInactivos && !el.activo) return false;
      if (filtroCat !== 'todos' && el.categoria !== filtroCat) return false;
      if (q) {
        const texto = `${el.codigo} ${el.nombre} ${el.tipo} ${el.ubicacion}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }
      return true;
    });
  }, [elementos, filtroCat, mostrarInactivos, busqueda]);

  const metricas = useMemo(() => {
    const activos = elementos.filter((e) => e.activo);
    const av = activos.filter((e) => e.categoria === CategoriaElemento.Audiovisual);
    const dep = activos.filter((e) => e.categoria === CategoriaElemento.Deportivo);
    const totalUnidadesDep = dep.reduce((acc, e) => acc + e.cantidadTotal, 0);
    return {
      totalActivos: activos.length,
      totalAudiovisuales: av.length,
      gruposDeportivos: dep.length,
      totalUnidadesDep,
    };
  }, [elementos]);

  const abrirNuevo = () => {
    setEditandoId(undefined);
    setCategoria(CategoriaElemento.Audiovisual);
    setCodigo('AV-EQP-011');
    setNombre('');
    setTipo('Portátil');
    setEstadoFisico('Óptimo');
    setCantidadTotal(1);
    setUbicacion('Estante A1');
    setActivo(true);
    setModalAbierto(true);
  };

  const abrirEdicion = (el: Elemento) => {
    setEditandoId(el.id);
    setCodigo(el.codigo);
    setNombre(el.nombre);
    setCategoria(el.categoria);
    setTipo(el.tipo);
    setEstadoFisico(el.estadoFisico);
    setCantidadTotal(el.cantidadTotal);
    setUbicacion(el.ubicacion);
    setActivo(el.activo);
    setModalAbierto(true);
  };

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onGuardarElemento({
      id: editandoId,
      codigo,
      nombre,
      categoria,
      tipo,
      estadoFisico,
      cantidadTotal: categoria === CategoriaElemento.Audiovisual ? 1 : cantidadTotal,
      ubicacion,
      activo,
    });
    if (ok) {
      setModalAbierto(false);
    }
  };

  const exportarCatalogoCsv = () => {
    exportarCsvDescarga(
      'Elementos_Catalogo.csv',
      [
        'Codigo',
        'Nombre',
        'Categoria',
        'Tipo',
        'Estado_Fisico',
        'Activo',
        'Cantidad_Total',
        'Disponibles_Hoy',
        'Ubicacion',
      ],
      elementos.map((el) => [
        el.codigo,
        el.nombre,
        el.categoria === CategoriaElemento.Audiovisual ? 'Audiovisual' : 'Deportivo',
        el.tipo,
        el.estadoFisico,
        el.activo ? 'Sí' : 'No',
        String(el.cantidadTotal),
        String(calcularUnidadesDisponibles(el, novedades)),
        el.ubicacion,
      ])
    );
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">
              Administración de inventario maestro · RF-01 y RF-02
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">
              Catálogo de elementos de préstamo
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Los equipos audiovisuales se controlan uno por uno con código individual; los
              deportivos agrupan sus existencias bajo un código general con cantidad total.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={exportarCatalogoCsv}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            {!soloConsulta && (
              <button
                type="button"
                onClick={abrirNuevo}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-900 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar elemento</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          <div>
            <p className="text-xs text-slate-500">Códigos activos</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metricas.totalActivos}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Incluidos en el cierre diario</p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Equipos audiovisuales</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metricas.totalAudiovisuales}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Control individual (1 por código)</p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Referencias deportivas</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metricas.gruposDeportivos}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Control por código general</p>
          </div>

          <div className="lg:border-l lg:border-slate-200 lg:pl-6">
            <p className="text-xs text-slate-500">Unidades deportivas totales</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metricas.totalUnidadesDep}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Suma de balones e implementos</p>
          </div>
        </div>
      </section>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            {(
              [
                { id: 'todos', label: 'Todas las categorías' },
                { id: CategoriaElemento.Audiovisual, label: 'Audiovisuales' },
                { id: CategoriaElemento.Deportivo, label: 'Deportivos' },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => setFiltroCat(op.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filtroCat === op.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="rounded border-slate-300 text-blue-900 focus:ring-blue-800"
            />
            <span>Mostrar dados de baja / inactivos</span>
          </label>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código, nombre o estante..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
          />
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Nombre y ubicación</th>
                <th className="py-3 px-4">Categoría y tipo</th>
                <th className="py-3 px-4">Estado físico</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Disponibilidad actual</th>
                {!soloConsulta && <th className="py-3 px-4 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filtrados.map((el) => {
                const afuera = calcularUnidadesAfueraPorNovedad(el.codigo, novedades);
                const disponibles = Math.max(0, el.cantidadTotal - afuera);

                return (
                  <tr
                    key={el.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      !el.activo ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {el.codigo}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">
                        {el.nombre} {!el.activo && '(Inactivo)'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{el.ubicacion}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {el.categoria === CategoriaElemento.Audiovisual
                        ? 'Audiovisual (Individual)'
                        : 'Deportivo (Cantidad)'}{' '}
                      · {el.tipo}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{el.estadoFisico}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {el.cantidadTotal}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {afuera === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 font-mono tabular-nums">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {disponibles}/{el.cantidadTotal} en sala
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-800 font-mono tabular-nums">
                          {disponibles}/{el.cantidadTotal} en sala · {afuera} afuera
                        </span>
                      )}
                    </td>
                    {!soloConsulta && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => abrirEdicion(el)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editandoId ? 'Editar elemento del catálogo' : 'Nuevo elemento del catálogo'}
              </h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={manejarSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Categoría de control
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setCategoria(CategoriaElemento.Audiovisual);
                      setCantidadTotal(1);
                      if (!editandoId && codigo.startsWith('DEP-')) setCodigo('AV-EQP-011');
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      categoria === CategoriaElemento.Audiovisual
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Audiovisual (Código individual)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoria(CategoriaElemento.Deportivo);
                      if (cantidadTotal === 1) setCantidadTotal(6);
                      if (!editandoId && codigo.startsWith('AV-')) setCodigo('DEP-IMP-02');
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      categoria === CategoriaElemento.Deportivo
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Deportivo (Código + cantidad)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Código</label>
                  <input
                    type="text"
                    required
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nombre descriptivo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Portátil HP ProBook 440 G10"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tipo</label>
                  <input
                    type="text"
                    required
                    placeholder="Portátil, Balón..."
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Estado físico
                  </label>
                  <select
                    value={estadoFisico}
                    onChange={(e) => setEstadoFisico(e.target.value as EstadoFisico)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    <option value="Óptimo">Óptimo</option>
                    <option value="Buen estado">Buen estado</option>
                    <option value="Desgaste leve">Desgaste leve</option>
                    <option value="En revisión">En revisión</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Cantidad total
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    disabled={categoria === CategoriaElemento.Audiovisual}
                    value={categoria === CategoriaElemento.Audiovisual ? 1 : cantidadTotal}
                    onChange={(e) => setCantidadTotal(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-700 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ubicación en oficina
                  </label>
                  <input
                    type="text"
                    required
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 pb-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-900 focus:ring-blue-800"
                  />
                  <span>Activo para inventario diario</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  Guardar en catálogo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
