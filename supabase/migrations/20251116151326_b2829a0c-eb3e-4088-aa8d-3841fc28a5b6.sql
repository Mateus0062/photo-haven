-- Create profiles table
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Users can view all profiles"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

-- Create photos table
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  url text not null,
  title text,
  description text,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.photos enable row level security;

-- Photos policies
create policy "Users can view own photos"
  on public.photos for select
  using (auth.uid() = user_id);

create policy "Users can insert own photos"
  on public.photos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own photos"
  on public.photos for update
  using (auth.uid() = user_id);

create policy "Users can delete own photos"
  on public.photos for delete
  using (auth.uid() = user_id);

-- Create albums table
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  cover_photo_id uuid references public.photos(id) on delete set null,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.albums enable row level security;

-- Albums policies
create policy "Users can view own albums"
  on public.albums for select
  using (auth.uid() = user_id);

create policy "Users can insert own albums"
  on public.albums for insert
  with check (auth.uid() = user_id);

create policy "Users can update own albums"
  on public.albums for update
  using (auth.uid() = user_id);

create policy "Users can delete own albums"
  on public.albums for delete
  using (auth.uid() = user_id);

-- Create album_photos junction table
create table public.album_photos (
  album_id uuid references public.albums(id) on delete cascade not null,
  photo_id uuid references public.photos(id) on delete cascade not null,
  added_at timestamp with time zone default now() not null,
  primary key (album_id, photo_id)
);

-- Enable RLS
alter table public.album_photos enable row level security;

-- Album photos policies
create policy "Users can view photos in own albums"
  on public.album_photos for select
  using (
    exists (
      select 1 from public.albums
      where albums.id = album_photos.album_id
      and albums.user_id = auth.uid()
    )
  );

create policy "Users can add photos to own albums"
  on public.album_photos for insert
  with check (
    exists (
      select 1 from public.albums
      where albums.id = album_photos.album_id
      and albums.user_id = auth.uid()
    )
  );

create policy "Users can remove photos from own albums"
  on public.album_photos for delete
  using (
    exists (
      select 1 from public.albums
      where albums.id = album_photos.album_id
      and albums.user_id = auth.uid()
    )
  );

-- Create storage bucket for photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true);

-- Storage policies
create policy "Users can upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Anyone can view photos"
  on storage.objects for select
  using (bucket_id = 'photos');

create policy "Users can update own photos"
  on storage.objects for update
  using (
    bucket_id = 'photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'photos' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to automatically create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.email);
  return new;
end;
$$;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();