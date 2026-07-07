create or replace function public.create_training_program_atomic(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_program_id uuid;
  day_item jsonb;
  exercise_item jsonb;
  new_day_id uuid;
begin
  if coalesce(payload->>'customer_id', '') = '' then
    raise exception 'customer_id required';
  end if;

  if coalesce(payload->>'title', '') = '' then
    raise exception 'title required';
  end if;

  insert into public.training_programs (customer_id, title, goal, description, coach_name, starts_at, ends_at, is_active)
  values (
    (payload->>'customer_id')::uuid,
    payload->>'title',
    nullif(payload->>'goal', ''),
    nullif(payload->>'description', ''),
    nullif(payload->>'coach_name', ''),
    nullif(payload->>'starts_at', '')::date,
    nullif(payload->>'ends_at', '')::date,
    true
  )
  returning id into new_program_id;

  for day_item in select * from jsonb_array_elements(coalesce(payload->'days', '[]'::jsonb)) loop
    insert into public.training_program_days (program_id, day_number, title, notes)
    values (new_program_id, coalesce((day_item->>'day_number')::int, 1), coalesce(day_item->>'title', 'Giorno'), nullif(day_item->>'notes', ''))
    returning id into new_day_id;

    for exercise_item in select * from jsonb_array_elements(coalesce(day_item->'exercises', '[]'::jsonb)) loop
      if coalesce(exercise_item->>'exercise_id', '') = '' then
        raise exception 'exercise_id required';
      end if;

      insert into public.training_day_exercises (day_id, exercise_id, position, sets, reps, rest_seconds, notes)
      values (
        new_day_id,
        (exercise_item->>'exercise_id')::uuid,
        coalesce((exercise_item->>'position')::int, 1),
        nullif(exercise_item->>'sets', '')::int,
        nullif(exercise_item->>'reps', ''),
        nullif(exercise_item->>'rest_seconds', '')::int,
        nullif(exercise_item->>'notes', '')
      );
    end loop;
  end loop;

  return new_program_id;
end;
$$;
