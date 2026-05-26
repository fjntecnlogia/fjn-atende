"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, Plus, RefreshCw, LogOut, Trash2, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { relativeTime } from "@/lib/utils";

interface Instance {
  id: number;
  session_name: string;
  phone_number: string | null;
  status: "pending" | "connecting" | "connected" | "disconnected" | "error";
  last_qr_at: string | null;
  last_connected_at: string | null;
  created_at: string;
}

export default function WhatsAppPage() {
  const qc = useQueryClient();
  const [openInstance, setOpenInstance] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: instances = [] } = useQuery<Instance[]>({
    queryKey: ["instances"],
    queryFn: async () => (await api.get("/instances")).data,
    refetchInterval: 10_000,
  });

  async function createInstance() {
    try {
      await api.post("/instances");
      toast.success("Instância criada");
      qc.invalidateQueries({ queryKey: ["instances"] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha ao criar");
    }
  }

  async function startInstance(id: number) {
    setOpenInstance(id);
    setQrCode(null);
    try {
      const r = await api.post(`/instances/${id}/start`);
      setQrCode(r.data.qr ?? null);
      toast.success("Sessão iniciada — escaneie o QR");
      qc.invalidateQueries({ queryKey: ["instances"] });
      pollStatus(id);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? "Falha ao iniciar");
      setOpenInstance(null);
    }
  }

  async function pollStatus(id: number) {
    let tries = 0;
    const interval = setInterval(async () => {
      tries++;
      try {
        const r = await api.get(`/instances/${id}/status`);
        if (r.data?.qrcode) setQrCode(r.data.qrcode);
        const isConn = r.data?.status === "CONNECTED" || r.data?.status === "inChat";
        if (isConn) {
          toast.success("WhatsApp conectado! 🎉", { duration: 5000 });
          clearInterval(interval);
          setOpenInstance(null);
          setQrCode(null);
          qc.invalidateQueries({ queryKey: ["instances"] });
        }
      } catch { /* ignora */ }
      if (tries > 60) clearInterval(interval); // máx 10 min
    }, 10_000);
  }

  async function logout(id: number) {
    if (!confirm("Desconectar essa instância?")) return;
    await api.post(`/instances/${id}/logout`);
    toast.success("Desconectado");
    qc.invalidateQueries({ queryKey: ["instances"] });
  }

  async function remove(id: number) {
    if (!confirm("Apagar instância? Histórico de conversas continua salvo.")) return;
    await api.delete(`/instances/${id}`);
    toast.success("Instância removida");
    qc.invalidateQueries({ queryKey: ["instances"] });
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-3">
            <Smartphone className="text-orange" />
            WhatsApp
          </h1>
          <p className="text-sm text-gray2 mt-1">Suas instâncias WhatsApp Business conectadas à IA</p>
        </div>
        <button onClick={createInstance} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Nova instância
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {instances.map((inst) => (
          <div key={inst.id} className="card p-5 hover:border-orange/30 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-light">{inst.phone_number ?? "(sem número)"}</p>
                <p className="text-xs text-gray2 font-mono">{inst.session_name}</p>
              </div>
              <Badge variant={inst.status === "connected" ? "active" : inst.status === "error" ? "closed" : "paused"}>
                {inst.status}
              </Badge>
            </div>

            <p className="text-xs text-gray2">
              {inst.last_connected_at
                ? `Conectado ${relativeTime(inst.last_connected_at)}`
                : `Criado ${relativeTime(inst.created_at)}`}
            </p>

            <div className="flex gap-2 mt-4">
              {inst.status !== "connected" && (
                <button onClick={() => startInstance(inst.id)}
                        className="btn-primary text-xs py-1.5 flex items-center gap-1 flex-1 justify-center">
                  <QrCode size={12} /> {inst.status === "pending" ? "Conectar" : "Reconectar"}
                </button>
              )}
              {inst.status === "connected" && (
                <button onClick={() => logout(inst.id)}
                        className="btn-ghost text-xs flex items-center gap-1 flex-1 justify-center">
                  <LogOut size={12} /> Desconectar
                </button>
              )}
              <button onClick={() => remove(inst.id)} className="btn-ghost text-xs text-red-400" title="Remover">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}

        {instances.length === 0 && (
          <div className="card p-10 col-span-full text-center">
            <Smartphone size={32} className="text-gray2 mx-auto mb-3" />
            <p className="text-gray2 text-sm mb-3">Nenhuma instância criada ainda</p>
            <button onClick={createInstance} className="btn-primary text-sm">
              Criar primeira instância
            </button>
          </div>
        )}
      </div>

      {/* Modal QR */}
      {openInstance && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="card p-6 max-w-md w-full text-center">
            <h3 className="font-display font-bold text-xl mb-2">Escaneie o QR</h3>
            <p className="text-sm text-gray2 mb-4">
              No WhatsApp Business → Aparelhos conectados → Conectar um aparelho
            </p>
            {qrCode ? (
              <div className="bg-white p-4 rounded-lg inline-block">
                {qrCode.startsWith("data:image") ? (
                  <img src={qrCode} alt="QR" className="w-64 h-64" />
                ) : (
                  <img src={`data:image/png;base64,${qrCode}`} alt="QR" className="w-64 h-64" />
                )}
              </div>
            ) : (
              <div className="w-64 h-64 mx-auto bg-navy2 rounded-lg flex items-center justify-center">
                <RefreshCw className="animate-spin text-orange" />
              </div>
            )}
            <button onClick={() => { setOpenInstance(null); setQrCode(null); }}
                    className="btn-ghost w-full mt-4">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
