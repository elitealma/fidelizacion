-- REPARACIÓN DE TABLA SEGUIMIENTOS Y ELIMINACIÓN DE DATOS DE PRUEBA
-- 1. Permitir que existan seguimientos sin pedido o asesor (necesario para nuevos clientes de IA)
ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN pedido_id DROP NOT NULL;
ALTER TABLE public.seguimientos_fidelizacion ALTER COLUMN asesor_id DROP NOT NULL;

-- 2. Limpiar Datos de Prueba
-- Borramos registros que no tienen WhatsApp o tienen nombres de prueba conocidos
DELETE FROM public.seguimientos_fidelizacion WHERE whatsapp IS NULL;
DELETE FROM public.interacciones WHERE whatsapp IS NULL;
DELETE FROM public.pedidos WHERE cliente_id IS NULL;

-- 3. Webhook de Llamadas IA (Versión Totalmente Autónoma)
-- Ahora crea pedidos y seguimientos si es necesario para que aparezcan en la web
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
    IF jsonb_typeof(payload) = 'array' THEN item := payload->0; ELSE item := payload; END IF;

    v_whatsapp := item->>'numero_cliente';
    IF v_whatsapp IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No phone number'); END IF;

    v_cliente_nombre := COALESCE(item->>'cliente', 'Cliente IA');
    
    BEGIN
        v_timestamp := (substring(item->>'fecha_hora' from 7 for 4) || '-' ||
                        substring(item->>'fecha_hora' from 4 for 2) || '-' ||
                        substring(item->>'fecha_hora' from 1 for 2) || ' ' ||
                        substring(item->>'fecha_hora' from 12 for 5) || ':00')::timestamptz;
    EXCEPTION WHEN OTHERS THEN v_timestamp := NOW();
    END;

    IF (item->>'clasificacion_principal') ILIKE '%buzón%' OR (item->>'motivo_desconexion') = 'voicemail_reached' THEN
        v_resultado := 'BUZON';
    ELSIF (item->>'clasificacion_principal') ILIKE '%éxito%' OR (item->>'clasificacion_principal') ILIKE '%exito%' OR (item->>'clasificacion_principal') ILIKE '%complet%' THEN
        v_resultado := 'EXITOSA';
    ELSIF (item->>'clasificacion_principal') ILIKE '%no contest%' OR (item->>'motivo_desconexion') = 'busy' THEN
        v_resultado := 'NO_CONTESTO';
    ELSE
        v_resultado := 'PENDIENTE';
    END IF;

    -- A. Asegurar Cliente
    INSERT INTO public.clientes (whatsapp, nombre_completo, etiqueta)
    VALUES (v_whatsapp, v_cliente_nombre, 'NUEVO')
    ON CONFLICT (whatsapp) DO NOTHING;

    -- B. Asegurar Seguimiento (Para que sea visible en la web)
    -- Si no existe un seguimiento activo, creamos uno básico
    SELECT id INTO v_seguimiento_id FROM public.seguimientos_fidelizacion WHERE whatsapp = v_whatsapp ORDER BY created_at DESC LIMIT 1;
    
    IF v_seguimiento_id IS NULL THEN
        INSERT INTO public.seguimientos_fidelizacion (whatsapp, estado_tarea, prioridad, created_at)
        VALUES (v_whatsapp, 'ACTIVA', 'ALTA', NOW())
        RETURNING id INTO v_seguimiento_id;
    END IF;

    -- C. Insertar Interacción vinculada
    INSERT INTO public.interacciones (
        whatsapp, seguimiento_id, tipo, motivo, resultado, fue_venta, duracion_segundos, fecha_interaccion, notas
    ) VALUES (
        v_whatsapp, v_seguimiento_id, 'LLAMADA_IA', 'FIDELIZACION', v_resultado, false, 
        COALESCE((item->>'duracion_segundos')::integer, 0), v_timestamp, item->>'resumen_ia'
    );

    -- D. Actualizar cabecera del seguimiento
    UPDATE public.seguimientos_fidelizacion 
    SET resumen_llamada = item->>'resumen_ia', updated_at = NOW() 
    WHERE id = v_seguimiento_id;

    RETURN jsonb_build_object('success', true, 'whatsapp', v_whatsapp, 'resultado', v_resultado, 'seguimiento_id', v_seguimiento_id);
END;
$$;

-- 4. Recuperación Retroactiva: Crear seguimientos para interacciones huérfanas
INSERT INTO public.seguimientos_fidelizacion (whatsapp, estado_tarea, prioridad, created_at)
SELECT DISTINCT i.whatsapp, 'ACTIVA', 'ALTA', i.fecha_interaccion
FROM public.interacciones i
LEFT JOIN public.seguimientos_fidelizacion s ON i.whatsapp = s.whatsapp
WHERE s.id IS NULL AND i.whatsapp IS NOT NULL;

-- 5. Vincular interacciones ahora que existen los seguimientos
UPDATE public.interacciones i
SET seguimiento_id = s.id
FROM public.seguimientos_fidelizacion s
WHERE i.whatsapp = s.whatsapp AND i.seguimiento_id IS NULL;
