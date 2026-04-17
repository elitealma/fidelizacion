-- VINCULACIÓN DIRECTA SEGUIMIENTOS <-> CLIENTES
-- Esto permite que la web muestre los datos del cliente incluso si no hay un pedido previo.

-- 1. Crear la relación de llave foránea (usando whatsapp como puente)
ALTER TABLE public.seguimientos_fidelizacion
ADD CONSTRAINT fk_seguimientos_clientes_direct
FOREIGN KEY (whatsapp) REFERENCES public.clientes(whatsapp);

-- 2. Asegurar que los datos estén sincronizados
-- Ya lo hicimos en el paso anterior, pero esto garantiza consistencia.

-- 3. Notificar a PostgREST
NOTIFY pgrst, 'reload schema';
