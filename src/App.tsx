/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { db, auth } from './lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { 
  Music, 
  Plus, 
  Youtube, 
  Heart, 
  Flag, 
  Trash2, 
  Tv, 
  Sparkles, 
  LogOut, 
  LogIn,
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { generateMarketingCopy } from './lib/gemini';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error(`Operation failed: ${errInfo.error}`);
}

// --- Components ---

const TV_NETWORKS = [
  "TBN (Trinity Broadcasting Network)",
  "Daystar Television Network",
  "CBN (Christian Broadcasting Network)",
  "Gospel Music Channel (UPtv)",
  "Hillsong Channel",
  "God TV",
  "Emmanuel TV"
];

function YouTubeEmbed({ url }: { url: string }) {
  const getEmbedUrl = (url: string) => {
    try {
      const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1]?.split('?')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    } catch {
      return null;
    }
  };

  const embedUrl = getEmbedUrl(url);

  if (!embedUrl) return <div className="bg-stone-200 aspect-video flex items-center justify-center text-stone-500">Invalid YouTube URL</div>;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg shadow-inner bg-black">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

function PromotionCard({ promotion, onLike, onReport, onDelete, isAdmin, currentUserId }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      <Card className="overflow-hidden border-none shadow-lg bg-brand-warm-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl text-brand-olive">{promotion.title}</CardTitle>
              <CardDescription className="text-stone-600 italic">by {promotion.artist}</CardDescription>
            </div>
            <Badge variant="outline" className="border-brand-olive text-brand-olive">
              {promotion.network || "General Promotion"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <YouTubeEmbed url={promotion.youtubeUrl} />
          <p className="text-stone-700 line-clamp-3">{promotion.description}</p>
        </CardContent>
        <CardFooter className="flex justify-between pt-2 border-t border-stone-100">
          <div className="flex gap-4">
            <Button variant="ghost" size="sm" onClick={() => onLike(promotion.id)} className="text-stone-600 hover:text-red-500">
              <Heart className={`w-4 h-4 mr-1 ${promotion.likes > 0 ? 'fill-red-500 text-red-500' : ''}`} />
              {promotion.likes}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onReport(promotion.id)} className="text-stone-600 hover:text-amber-600">
              <Flag className="w-4 h-4 mr-1" />
              {promotion.reports}
            </Button>
          </div>
          {(isAdmin || promotion.userId === currentUserId) && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(promotion.id)} className="text-stone-400 hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}

function Dashboard() {
  const { user, profile, signIn, logout } = useAuth();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newPromo, setNewPromo] = useState({ title: '', artist: '', youtubeUrl: '', description: '', network: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPromotions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'promotions');
    });
    return unsubscribe;
  }, []);

  const handleAddPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'promotions'), {
        ...newPromo,
        userId: user.uid,
        likes: 0,
        reports: 0,
        createdAt: serverTimestamp()
      });
      setNewPromo({ title: '', artist: '', youtubeUrl: '', description: '', network: '' });
      setIsAdding(false);
      toast.success("Promotion posted successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'promotions');
    }
  };

  const handleLike = async (id: string) => {
    try {
      await updateDoc(doc(db, 'promotions', id), { likes: increment(1) });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `promotions/${id}`);
    }
  };

  const handleReport = async (id: string) => {
    try {
      await updateDoc(doc(db, 'promotions', id), { reports: increment(1) });
      toast.info("Reported. We will review this content.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `promotions/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'promotions', id));
      toast.success("Promotion deleted.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `promotions/${id}`);
    }
  };

  const handleGenerateAI = async () => {
    if (!newPromo.title || !newPromo.artist) {
      toast.error("Please enter song title and artist first.");
      return;
    }
    setAiLoading(true);
    try {
      const result = await generateMarketingCopy(newPromo.title, newPromo.artist, newPromo.description);
      setAiResult(result);
      toast.success("AI Marketing Copy Generated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate AI copy.");
    } finally {
      setAiLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-none shadow-2xl bg-brand-warm-white/90 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-brand-olive rounded-full flex items-center justify-center mb-4">
              <Music className="text-white w-8 h-8" />
            </div>
            <CardTitle className="text-3xl text-brand-olive">Emmanuel Promoter</CardTitle>
            <CardDescription>Empowering Christian Artists with AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-stone-600">Sign in to promote your music and use our AI marketing tools.</p>
            <Button onClick={signIn} className="w-full bg-brand-olive hover:bg-brand-olive/90 text-white h-12 text-lg">
              <LogIn className="w-5 h-5 mr-2" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-olive rounded-full flex items-center justify-center">
            <Music className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-brand-olive">Emmanuel Promoter</h1>
            <p className="text-stone-500 text-sm">Welcome back, {user.displayName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger>
              <Button className="bg-brand-olive hover:bg-brand-olive/90 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-brand-cream border-none">
              <DialogHeader>
                <DialogTitle className="text-2xl text-brand-olive">Post Your Music</DialogTitle>
                <DialogDescription>Share your Christian music video with the community.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPromotion} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Song Title</Label>
                    <Input id="title" value={newPromo.title} onChange={e => setNewPromo({...newPromo, title: e.target.value})} placeholder="e.g. Amazing Grace" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="artist">Artist Name</Label>
                    <Input id="artist" value={newPromo.artist} onChange={e => setNewPromo({...newPromo, artist: e.target.value})} placeholder="e.g. Emmanuel Choir" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">YouTube URL</Label>
                  <Input id="url" value={newPromo.youtubeUrl} onChange={e => setNewPromo({...newPromo, youtubeUrl: e.target.value})} placeholder="https://www.youtube.com/watch?v=..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="network">Submit to Network</Label>
                  <Select onValueChange={(val: string) => setNewPromo({...newPromo, network: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a Christian TV Network" />
                    </SelectTrigger>
                    <SelectContent>
                      {TV_NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description / Campaign Goals</Label>
                  <Input id="desc" value={newPromo.description} onChange={e => setNewPromo({...newPromo, description: e.target.value})} placeholder="Tell us about your song..." />
                </div>
                
                <div className="pt-4 flex gap-2">
                  <Button type="submit" className="flex-1 bg-brand-olive text-white">
                    <Send className="w-4 h-4 mr-2" />
                    Post Promotion
                  </Button>
                  <Button type="button" variant="outline" onClick={handleGenerateAI} disabled={aiLoading} className="border-brand-olive text-brand-olive">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    AI Marketing Help
                  </Button>
                </div>

                {aiResult && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 p-4 bg-white rounded-lg border border-brand-olive/20 text-sm space-y-3">
                    <h4 className="font-bold text-brand-olive flex items-center"><Sparkles className="w-3 h-3 mr-1" /> AI Marketing Suggestions</h4>
                    <div>
                      <p className="font-semibold">Social Post:</p>
                      <p className="text-stone-600">{aiResult.socialPost}</p>
                    </div>
                    <div>
                      <p className="font-semibold">TV Pitch:</p>
                      <p className="text-stone-600">{aiResult.pitch}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {aiResult.hashtags.map((h: string) => <Badge key={h} variant="secondary">{h}</Badge>)}
                    </div>
                  </motion.div>
                )}
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" onClick={logout} className="text-stone-500 hover:text-brand-olive">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-stone-200/50 p-1 mb-6">
          <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-brand-olive">
            All Promotions
          </TabsTrigger>
          <TabsTrigger value="my" className="data-[state=active]:bg-white data-[state=active]:text-brand-olive">
            My Campaigns
          </TabsTrigger>
          <TabsTrigger value="networks" className="data-[state=active]:bg-white data-[state=active]:text-brand-olive">
            TV Networks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {promotions.map(p => (
                <PromotionCard 
                  key={p.id} 
                  promotion={p} 
                  onLike={handleLike} 
                  onReport={handleReport} 
                  onDelete={handleDelete}
                  isAdmin={profile?.role === 'admin'}
                  currentUserId={user.uid}
                />
              ))}
            </AnimatePresence>
          </div>
          {promotions.length === 0 && (
            <div className="text-center py-20 text-stone-400">
              <Youtube className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No promotions yet. Be the first to post!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="my">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {promotions.filter(p => p.userId === user.uid).map(p => (
              <PromotionCard 
                key={p.id} 
                promotion={p} 
                onLike={handleLike} 
                onReport={handleReport} 
                onDelete={handleDelete}
                isAdmin={profile?.role === 'admin'}
                currentUserId={user.uid}
              />
            ))}
          </div>
          {promotions.filter(p => p.userId === user.uid).length === 0 && (
            <div className="text-center py-20 text-stone-400">
              <Plus className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>You haven't posted any campaigns yet.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="networks">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {TV_NETWORKS.map(network => (
              <Card key={network} className="bg-white/50 border-none hover:bg-white transition-colors cursor-pointer">
                <CardHeader className="p-4">
                  <Tv className="w-8 h-8 text-brand-olive mb-2" />
                  <CardTitle className="text-lg">{network}</CardTitle>
                  <CardDescription>Official Submission Channel</CardDescription>
                </CardHeader>
                <CardFooter className="p-4 pt-0">
                  <Button variant="link" className="p-0 text-brand-olive h-auto">View Requirements</Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
