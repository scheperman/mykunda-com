-- ============================================================
--  MyKunda — een terugbetaling krijgt eindelijk een bericht (30-08-2026)
--  Toegepast via de Supabase-MCP als migratie 'payment_refund_notification'.
--
--  'refunded' viel bewust buiten deze trigger, met als reden: "een
--  terugbetaling is boekhoudkundig werk met een eigen bericht, geen
--  automatische bon". Dat eigen bericht is nooit gebouwd, en
--  payment_refunds_sync_status() zet de status om zonder enige melding.
--  Gevolg: de klant kreeg zijn geld terug zonder één regel schriftelijk.
--
--  notify-payment kent sinds 30-08-2026 de uitkomst 'refunded' en stuurt dan
--  paymentRefundEmail. Het terugbetaalde bedrag gaat mee: dat kan lager zijn
--  dan het oorspronkelijke bedrag (payment_refunds is optelbaar).
-- ============================================================

create or replace function public.notify_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text := 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/notify-payment';
  v_naam    text;
  v_plan    text;
  v_bedrag  text;
  v_terug   text;
  v_minor   bigint;
  v_methode text;
  v_datum   timestamptz;
  v_sleutel text;
  v_headers jsonb;
  v_body    jsonb;
begin
  -- Alleen echte wisselingen, en alleen naar een uitkomst waar de klant
  -- iets aan heeft. 'processing' is onderweg, niet iets om over te mailen.
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('succeeded', 'failed', 'cancelled', 'expired', 'refunded') then
    return new;
  end if;

  -- De naam die de KOPER opgaf gaat voor. Alleen als die er niet is,
  -- valt het terug op de naam van het account waarmee betaald is.
  v_naam := coalesce(
    nullif(btrim(new.metadata #>> '{ownership_intake,name}'), ''),
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = new.user_id)
  );

  v_plan := coalesce(
    nullif(new.metadata ->> 'plan_name', ''),
    (select lp.name from public.listing_plans lp where lp.id = new.plan_id),
    new.plan_id,
    'MyKunda service'
  );

  -- Zelfde weergave als de edge functions gebruikten: "D 4,500", en
  -- alleen centen tonen als ze er zijn.
  v_bedrag :=
    case when coalesce(new.currency, 'GMD') = 'GMD'
         then 'D '
         else coalesce(new.currency, 'GMD') || ' '
    end
    || regexp_replace(
         to_char(new.amount_minor / 100.0, 'FM9,999,999,990.00'),
         '\.00$', ''
       );

  -- Terugbetaald bedrag: de som van de regels in payment_refunds. Kan lager
  -- zijn dan het oorspronkelijke bedrag; is er niets te vinden, dan valt de
  -- mail terug op het volledige bedrag.
  if new.status = 'refunded' then
    select coalesce(sum(r.amount_minor), 0) into v_minor
      from public.payment_refunds r
     where r.payment_id = new.id;
    if v_minor > 0 then
      v_terug :=
        case when coalesce(new.currency, 'GMD') = 'GMD'
             then 'D '
             else coalesce(new.currency, 'GMD') || ' '
        end
        || regexp_replace(
             to_char(v_minor / 100.0, 'FM9,999,999,990.00'),
             '\.00$', ''
           );
    end if;
  end if;

  -- De kolom houdt de korte providercode aan (nodig voor de
  -- walletlimieten); in de mail hoort een leesbare naam.
  v_methode := case new.method::text
    when 'wave'          then 'Wave mobile money'
    when 'afrimoney'     then 'Afrimoney'
    when 'qmoney'        then 'QMoney'
    when 'aps'           then 'APS'
    when 'card'          then 'Card payment'
    when 'bank_transfer' then 'Bank transfer'
    else new.method::text
  end;

  v_datum := case when new.status = 'succeeded'
                  then coalesce(new.paid_at, now())
                  else now()
             end;

  v_body := jsonb_strip_nulls(jsonb_build_object(
    'name',             nullif(v_naam, ''),
    'email',            nullif(new.customer_email, ''),
    'phone',            nullif(new.customer_phone, ''),
    'plan',             v_plan,
    'reference',        new.reference,
    'amount',           v_bedrag,
    'refund_amount',    v_terug,
    'method',           v_methode,
    'awaitingTransfer', false,
    'date',             to_char(v_datum at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    -- notify-payment kiest op dit veld tussen een bon, een "het is niet
    -- gelukt"-bericht en een terugbetaalbevestiging.
    'outcome',          case when new.status = 'succeeded'
                             then null
                             else new.status::text
                        end,
    'source',           'payments_trigger'
  ));

  begin
    select s.decrypted_secret into v_sleutel
      from vault.decrypted_secrets s
     where s.name = 'notify_shared_key';
  exception when others then
    v_sleutel := null;
  end;

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  if v_sleutel is not null and v_sleutel <> '' then
    v_headers := v_headers || jsonb_build_object('x-notify-key', v_sleutel);
  else
    raise warning 'notify_payment_status_change: geen notify_shared_key in de kluis, verzoek gaat zonder sleutel de deur uit';
  end if;

  perform net.http_post(
    url                  => v_url,
    body                 => v_body,
    headers              => v_headers,
    timeout_milliseconds => 8000
  );

  return new;

exception when others then
  -- De betaling gaat voor de mail. Loopt het versturen stuk, dan blijft
  -- de statuswissel staan en zien we hier waarom.
  raise warning 'notify_payment_status_change: mail niet in de wachtrij voor % (% -> %): %',
    new.reference, old.status, new.status, sqlerrm;
  return new;
end
$$;

drop trigger if exists payments_notify_status on public.payments;

create trigger payments_notify_status
after update of status on public.payments
for each row
when (new.status is distinct from old.status
      and new.status = any (array['succeeded','failed','cancelled','expired','refunded']::payment_status[]))
execute function public.notify_payment_status_change();
