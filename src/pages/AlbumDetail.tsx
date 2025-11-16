import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Photo {
  id: string;
  url: string;
  title: string | null;
}

interface Album {
  id: string;
  name: string;
  description: string | null;
}

const AlbumDetail = () => {
  const { id } = useParams();
  const [user, setUser] = useState<User | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
  const [availablePhotos, setAvailablePhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadAlbumData(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadAlbumData(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, id]);

  const loadAlbumData = async (userId: string) => {
    if (!id) return;

    setLoading(true);

    const { data: albumData, error: albumError } = await supabase
      .from("albums")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (albumError) {
      toast({
        title: "Erro ao carregar álbum",
        description: albumError.message,
        variant: "destructive",
      });
      navigate("/albums");
      return;
    }

    setAlbum(albumData);

    const { data: photosData } = await supabase
      .from("album_photos")
      .select("photos(id, url, title)")
      .eq("album_id", id);

    const photos = photosData?.map((ap: any) => ap.photos).filter(Boolean) || [];
    setAlbumPhotos(photos);

    const { data: allPhotos } = await supabase
      .from("photos")
      .select("id, url, title")
      .eq("user_id", userId);

    const photosInAlbum = new Set(photos.map((p: Photo) => p.id));
    const available = allPhotos?.filter((p) => !photosInAlbum.has(p.id)) || [];
    setAvailablePhotos(available);

    setLoading(false);
  };

  const handleAddPhotos = async () => {
    if (!id || selectedPhotos.length === 0) return;

    const inserts = selectedPhotos.map((photoId) => ({
      album_id: id,
      photo_id: photoId,
    }));

    const { error } = await supabase.from("album_photos").insert(inserts);

    if (error) {
      toast({
        title: "Erro ao adicionar fotos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Fotos adicionadas!",
        description: `${selectedPhotos.length} foto(s) adicionada(s) ao álbum.`,
      });
      setDialogOpen(false);
      setSelectedPhotos([]);
      if (user) loadAlbumData(user.id);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!id) return;

    const { error } = await supabase
      .from("album_photos")
      .delete()
      .eq("album_id", id)
      .eq("photo_id", photoId);

    if (error) {
      toast({
        title: "Erro ao remover foto",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Foto removida",
        description: "A foto foi removida do álbum.",
      });
      if (user) loadAlbumData(user.id);
    }
  };

  if (!user || !album) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <main className="container py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/albums")} className="gap-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Álbuns
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">{album.name}</h1>
              {album.description && (
                <p className="text-muted-foreground mb-2">{album.description}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {albumPhotos.length} {albumPhotos.length === 1 ? "foto" : "fotos"}
              </p>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Fotos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Adicionar Fotos ao Álbum</DialogTitle>
                </DialogHeader>

                {availablePhotos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Todas as suas fotos já estão neste álbum
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {availablePhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:border-primary"
                          style={{
                            borderColor: selectedPhotos.includes(photo.id)
                              ? "hsl(var(--primary))"
                              : "transparent",
                          }}
                          onClick={() => {
                            setSelectedPhotos((prev) =>
                              prev.includes(photo.id)
                                ? prev.filter((id) => id !== photo.id)
                                : [...prev, photo.id]
                            );
                          }}
                        >
                          <img
                            src={photo.url}
                            alt={photo.title || "Foto"}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <Checkbox checked={selectedPhotos.includes(photo.id)} />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDialogOpen(false);
                          setSelectedPhotos([]);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleAddPhotos}
                        disabled={selectedPhotos.length === 0}
                      >
                        Adicionar ({selectedPhotos.length})
                      </Button>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando fotos...</p>
          </div>
        ) : albumPhotos.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <h3 className="text-lg font-medium mb-2">Nenhuma foto neste álbum</h3>
            <p className="text-muted-foreground mb-4">
              Adicione fotos para começar a organizar seu álbum
            </p>
            <Button onClick={() => setDialogOpen(true)}>Adicionar Fotos</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {albumPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted shadow-soft hover:shadow-hover transition-all"
              >
                <img
                  src={photo.url}
                  alt={photo.title || "Foto"}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {photo.title && (
                      <h3 className="text-white font-medium mb-3 line-clamp-1">
                        {photo.title}
                      </h3>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => handleRemovePhoto(photo.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AlbumDetail;
