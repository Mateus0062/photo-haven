import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Photo {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

const Home = () => {
  const [user, setUser] = useState<User | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadPhotos(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadPhotos(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadPhotos = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Erro ao carregar fotos",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setPhotos(data || []);
    }
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setUploading(true);
    const fileExt = selectedFile.name.split(".").pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
      .from("photos")
      .upload(fileName, selectedFile);

    if (uploadError) {
      toast({
        title: "Erro ao fazer upload",
        description: uploadError.message,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("photos")
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase.from("photos").insert({
      user_id: user.id,
      url: publicUrl,
      title: title || null,
      description: description || null,
    });

    if (dbError) {
      toast({
        title: "Erro ao salvar foto",
        description: dbError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Foto adicionada!",
        description: "Sua foto foi adicionada com sucesso.",
      });
      setDialogOpen(false);
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      loadPhotos(user.id);
    }
    setUploading(false);
  };

  const handleDelete = async (photoId: string, photoUrl: string) => {
    if (!confirm("Tem certeza que deseja excluir esta foto?")) return;

    const path = photoUrl.split("/photos/")[1];
    await supabase.storage.from("photos").remove([path]);

    const { error } = await supabase.from("photos").delete().eq("id", photoId);

    if (error) {
      toast({
        title: "Erro ao excluir foto",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Foto excluída",
        description: "A foto foi removida com sucesso.",
      });
      if (user) loadPhotos(user.id);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Minhas Fotos</h1>
            <p className="text-muted-foreground">
              {photos.length} {photos.length === 1 ? "foto" : "fotos"}
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Foto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Foto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="photo">Foto</Label>
                  <Input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Título (opcional)</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Dê um título para sua foto"
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
                <Button type="submit" className="w-full" disabled={uploading}>
                  {uploading ? "Enviando..." : "Adicionar Foto"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando fotos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhuma foto ainda</h3>
            <p className="text-muted-foreground mb-4">
              Comece adicionando sua primeira foto
            </p>
            <Button onClick={() => setDialogOpen(true)}>Adicionar Foto</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {photos.map((photo) => (
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
                      <h3 className="text-white font-medium mb-1 line-clamp-1">
                        {photo.title}
                      </h3>
                    )}
                    {photo.description && (
                      <p className="text-white/80 text-sm line-clamp-2 mb-3">
                        {photo.description}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => handleDelete(photo.id, photo.url)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Excluir
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

export default Home;
