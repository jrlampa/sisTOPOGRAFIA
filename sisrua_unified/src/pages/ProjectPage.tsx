import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  MapPin, 
  Calendar, 
  ChevronRight,
  Map as MapIcon,
  ShieldCheck,
  Zap,
  Loader2,
  Copy,
  Archive,
  FolderOpen,
  Eye,
  EyeOff,
  Trash2
} from "lucide-react";
import { ProjectService, ProjectMetadata } from "../services/projectService";
import { INITIAL_APP_STATE } from "../app/initialState";
import { NewProjectModal } from "../components/NewProjectModal";

export const ProjectPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, [showArchived]);

  const loadProjects = async () => {
    setLoading(true);
    const data = await ProjectService.listProjects(showArchived);
    setProjects(data);
    setLoading(false);
  };

  const handleCreateProject = async (data: Partial<ProjectMetadata>) => {
    const projectId = await ProjectService.createProject(
      data,
      INITIAL_APP_STATE
    );
    navigate(`/editor/${projectId}`);
  };

  const handleClone = async (id: string) => {
    try {
      const newId = await ProjectService.cloneProject(id);
      loadProjects();
      alert("Projeto clonado com sucesso!");
    } catch (err) {
      alert("Erro ao clonar projeto.");
    }
  };

  const handleToggleArchive = async (id: string, current: boolean) => {
    await ProjectService.setArchived(id, !current);
    loadProjects();
  };

  const getStatusStyle = (status: ProjectMetadata["status"]) => {
    switch (status) {
      case "audited": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "finalized": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      default: return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  const categories = ["Todas", ...Array.from(new Set(projects.map(p => p.category)))];

  const filteredProjects = projects.filter(p => {
    const matchesCategory = activeCategory === "Todas" || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Ações */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Meus Projetos</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-[0.2em] mt-1">Gerencie seus recortes e jurisdições espaciais</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${showArchived ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
          >
            {showArchived ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showArchived ? "Ver Ativos" : "Ver Arquivados"}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} />
            Novo Recorte
          </button>
        </div>
      </div>

      <NewProjectModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/5 p-4 rounded-[2rem] border border-white/5 backdrop-blur-md">
        <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-900 rounded-2xl border border-white/5 w-full">
          <Search size={16} className="text-slate-600" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar projeto por nome ou localidade..." 
            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-slate-700 font-bold"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar max-w-full">
           {categories.map(cat => (
             <button
               key={cat}
               onClick={() => setActiveCategory(cat)}
               className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${activeCategory === cat ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
             >
               {cat}
             </button>
           ))}
        </div>
      </div>

      {/* Grid de Projetos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
           <Loader2 className="w-12 h-12 animate-spin mb-4" />
           <p className="font-black uppercase tracking-widest text-xs">Sincronizando com a Nuvem IM3...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
           <MapIcon className="w-12 h-12 text-slate-700 mx-auto mb-4" />
           <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum recorte encontrado nesta jurisdição.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div 
              key={project.id}
              className={`group relative flex flex-col bg-slate-900/40 border border-white/10 rounded-3xl overflow-hidden hover:border-indigo-500/40 transition-all hover:shadow-2xl hover:shadow-indigo-500/10 ${project.isArchived ? 'opacity-60' : ''}`}
            >
              {/* Project Cover */}
              <div className="h-32 bg-slate-800 relative overflow-hidden bg-[url('/map-placeholder.png')] bg-cover">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                <div className="absolute top-4 left-4 flex gap-2">
                    <div className={`px-2 py-1 rounded-lg border text-[8px] font-black uppercase tracking-widest ${getStatusStyle(project.status)}`}>
                        {project.status}
                    </div>
                    <div className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-widest text-slate-400">
                        {project.category}
                    </div>
                </div>
                {project.isArchived && (
                   <div className="absolute top-4 right-4 px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-[8px] font-black uppercase tracking-widest text-amber-400">
                      Arquivado
                   </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-lg font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight leading-tight">{project.name}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <MapPin size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{project.location}</span>
                    </div>
                    <div className="text-[9px] font-black text-indigo-500/80 bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10 uppercase italic">
                      Área: {project.areaM2.toLocaleString()} m²
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar size={12} />
                    <span className="text-[9px] font-bold uppercase">{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <button 
                       onClick={() => handleClone(project.id)}
                       title="Duplicar Projeto"
                       className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-400 rounded-xl transition-all border border-white/5"
                     >
                       <Copy size={14} />
                     </button>
                     <Link 
                        to={`/editor/${project.id}`}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20"
                      >
                        Editor
                        <ChevronRight size={14} />
                      </Link>
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => handleToggleArchive(project.id, project.isArchived)}
                    title={project.isArchived ? "Desarquivar" : "Arquivar"}
                    className="p-2 bg-slate-900/80 backdrop-blur-md rounded-xl text-slate-400 hover:text-white border border-white/5"
                  >
                    <Archive size={16} />
                  </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
