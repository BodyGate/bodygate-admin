create table if not exists exercises_library (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  muscle_group text,

  equipment text,

  difficulty text,

  video_url text,

  image_url text,

  instructions text,

  is_active boolean default true,

  created_at timestamptz default now()
);

create index if not exists exercises_library_name_idx
on exercises_library(name);

create table if not exists training_programs (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid references customers(id) on delete cascade,

  title text not null,

  description text,

  coach_name text,

  goal text,

  is_active boolean default true,

  starts_at date,

  ends_at date,

  created_at timestamptz default now()
);

create index if not exists training_programs_customer_idx
on training_programs(customer_id);

create table if not exists training_program_days (
  id uuid primary key default gen_random_uuid(),

  program_id uuid references training_programs(id) on delete cascade,

  day_name text not null,

  sort_order integer default 0,

  created_at timestamptz default now()
);

create table if not exists training_day_exercises (
  id uuid primary key default gen_random_uuid(),

  day_id uuid references training_program_days(id) on delete cascade,

  exercise_id uuid references exercises_library(id) on delete cascade,

  sets text,
  reps text,
  rest text,
  rir text,
  tempo text,

  notes text,

  sort_order integer default 0,

  created_at timestamptz default now()
);

create index if not exists training_day_exercises_day_idx
on training_day_exercises(day_id);