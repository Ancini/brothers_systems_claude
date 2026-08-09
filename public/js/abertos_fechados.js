import { supabase } from "./supabase.js";

// Busca quem está aberto direto da View
export async function buscarAbertos() {
    const { data, error } = await supabase
        .from("vw_estabelecimentos_abertos")
        .select("*");

    if (error) {
        console.error("Erro ao buscar abertos:", error);
        return [];
    }
    return data;
}

// Busca quem está fechado direto da View
export async function buscarFechados() {
    const { data, error } = await supabase
        .from("vw_estabelecimentos_fechados")
        .select("*");

    if (error) {
        console.error("Erro ao buscar fechados:", error);
        return [];
    }
    return data;
}