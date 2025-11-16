import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Plus, FolderOpen, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Album {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  cover_photo_id: string | null;
  photos?: { url: string }[];
}

const Albums = () => {
  const [user, setUser] = useState<User | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadAlbums(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadAlbums(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadAlbums = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("albums")
      .select(`
        *,
        album_photos(
          photos(url)
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar álbuns",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const formattedAlbums = data.map((album: any) => ({
        ...album,
        photos: album.album_photos.map((ap: any) => ap.photos).filter(Boolean),
      }));
      setAlbums(formattedAlbums || []);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    const { error } = await supabase.from("albums").insert({
      user_id: user.id,
      name,
      description: description || null,
    });

    if (error) {
      toast({
        title: "Erro ao criar álbum",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Álbum criado!",
        description: "Seu álbum foi criado com sucesso.",
      });
      setDialogOpen(false);
      setName("");
      setDescription("");
      loadAlbums(user.id);
    }
    setCreating(false);
  };

  const handleDelete = async (albumId: string) => {
    if (!confirm("Tem certeza que deseja excluir este álbum?")) return;

    const { error } = await supabase.from("albums").delete().eq("id", albumId);

    if (error) {
      toast({
        title: "Erro ao excluir álbum",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Álbum excluído",
        description: "O álbum foi removido com sucesso.",
      });
      if (user) loadAlbums(user.id);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Meus Álbuns</h1>
            <p className="text-muted-foreground">
              {albums.length} {albums.length === 1 ? "álbum" : "álbuns"}
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Álbum
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Álbum</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Álbum</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Viagem 2024"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Adicione uma descrição"
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Criando..." : "Criar Álbum"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando álbuns...</p>
          </div>
        ) : albums.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum álbum ainda</h3>
            <p className="text-muted-foreground mb-4">
              Organize suas fotos criando álbuns
            </p>
            <Button onClick={() => setDialogOpen(true)}>Criar Álbum</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album) => (
              <Card key={album.id} className="group hover:shadow-hover transition-all cursor-pointer">
                <Link to={`/album/${album.id}`}>
                  <CardHeader className="pb-3">
                    <div className="aspect-video rounded-md overflow-hidden bg-muted mb-3">
                      {album.photos && album.photos.length > 0 ? (
                        <img
                          src={album.photos[0].url}
                          alt={album.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderOpen className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardTitle className="line-clamp-1">{album.name}</CardTitle>
                    {album.description && (
                      <CardDescription className="line-clamp-2">
                        {album.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {album.photos?.length || 0} {album.photos?.length === 1 ? "foto" : "fotos"}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete(album.id);
                        }}
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Albums;
