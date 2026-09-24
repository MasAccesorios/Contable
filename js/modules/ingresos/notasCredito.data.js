import { supabase } from '../../core/supabase.js';

export const NotasCreditoData = {
    async anularNotaCredito(id) {
        const { data, error } = await supabase.rpc('anular_nota_credito', { p_nc_id: parseInt(id) });
        if (error) throw new Error(error.message);
        return data;
    },
};
