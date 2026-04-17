-- MIGRACIÓN DEFINITIVA: RESOLUCIÓN DE AMBIGÜEDAD Y WEBHOOK RESILIENTE
-- Este archivo consolida los cambios realizados para habilitar las llamadas de IA sin errores de PostgREST

-- 1. Optimizar Tabla Interacciones
-- Permitir que las interacciones se guarden sin un seguimiento previo (clave para nuevas llamadas de IA)
ALTER TABLE IF EXISTS public.interacciones ALTER COLUMN seguimiento_id DROP NOT NULL;

-- 2. Eliminar Ambigüedades de PostgREST
-- Se eliminan las llaves foráneas duplicadas (whatsapp) para que los JOINS automáticos de la web no fallen.
-- Nota: Los índices de WhatsApp se mantienen para velocidad, pero las FKs causaban el error PGRST201.
ALTER TABLE IF EXISTS public.pedidos DROP CONSTRAINT IF EXISTS fk_pedido_wa;
ALTER TABLE IF EXISTS public.pedidos DROP CONSTRAINT IF EXISTS pedidos_whatsapp_fkey;
ALTER TABLE IF EXISTS public.seguimientos_fidelizacion DROP CONSTRAINT IF EXISTS fk_seguimiento_wa;
ALTER TABLE IF EXISTS public.seguimientos_fidelizacion DROP CONSTRAINT IF EXISTS seguimientos_fidelizacion_whatsapp_fkey;
ALTER TABLE IF EXISTS public.interacciones DROP CONSTRAINT IF EXISTS fk_interacciones_wa;

-- 3. Webhook de Llamadas IA (Versión Robusta)
CREATE OR REPLACE FUNCTION public.webhook_llamada_ia(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    item jsonb;
    v_whatsapp text;
    v_timestamp timestamptz;
    v_resultado text;
    v_seguimiento_id uuid;
    v_cliente_nombre text;
BEGIN
    -- Determinar si el payload es un objeto o un array de un solo elemento
    IF jsonb_typeof(payload) = 'array' THEN item := payload->0; ELSE item := payload; END IF;

    -- Extraer el WhatsApp (Id principal)
    v_whatsapp := item->>'numero_cliente';
    IF v_whatsapp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No phone number'); END IF;

    v_cliente_nombre := COALESCE(item->>'cliente', 'Cliente IA');
    
    -- Normalizar Fecha
    BEGIN
        v_timestamp := (substring(item->>'fecha_hora' from 7 for 4) || '-' ||
                        substring(item->>'fecha_hora' from 4 for 2) || '-' ||
                        substring(item->>'fecha_hora' from 1 for 2) || ' ' ||
                        substring(item->>'fecha_hora' from 12 for 5) || ':00')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
        v_timestamp := NOW();
    END;

    -- Clasificar Resultado
    IF (item->>'clasificacion_principal') ILIKE '%buzón%' OR (item->>'motivo_desconexion') = 'voicemail_reached' THEN
        v_resultado := 'BUZON';
    ELSIF (item->>'clasificacion_principal') ILIKE '%éxito%' OR (item->>'clasificacion_principal') ILIKE '%exito%' OR (item->>'clasificacion_principal') ILIKE '%complet%' THEN
        v_resultado := 'EXITOSA';
    ELSIF (item->>'clasificacion_principal') ILIKE '%no contest%' OR (item->>'motivo_desconexion') = 'busy' THEN
        v_resultado := 'NO_CONTESTO';
    ELSE
        v_resultado := 'PENDIENTE';
    END IF;

    -- Paso A: Asegurar que el cliente exista (Auto-registro)
    BEGIN
        INSERT INTO public.clientes (whatsapp, nombre_completo, etiqueta)
        VALUES (v_whatsapp, v_cliente_nombre, 'NUEVO')
        ON CONFLICT (whatsapp) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN END;

    -- Paso B: Buscar Seguimiento Actual para vincular (opcional para la web)
    SELECT id INTO v_seguimiento_id FROM public.seguimientos_fidelizacion WHERE whatsapp = v_whatsapp ORDER BY created_at DESC LIMIT 1;

    -- Paso C: Insertar Interacción (alimenta las estadísticas del Dashboard)
    INSERT INTO public.interacciones (
        whatsapp, seguimiento_id, tipo, motivo, resultado, fue_venta, duracion_segundos, fecha_interaccion, notas
    ) VALUES (
        v_whatsapp, v_seguimiento_id, 'LLAMADA_IA', 'FIDELIZACION', v_resultado, false, 
        COALESCE((item->>'duracion_segundos')::integer, 0), v_timestamp, item->>'resumen_ia'
    );

    -- Paso D: Vincular notas al seguimiento si existe
    IF v_seguimiento_id IS NOT NULL THEN
        UPDATE public.seguimientos_fidelizacion SET resumen_llamada = item->>'resumen_ia', updated_at = NOW() WHERE id = v_seguimiento_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'whatsapp', v_whatsapp, 'resultado', v_resultado, 'linked', v_seguimiento_id IS NOT NULL);
END;
$$;
