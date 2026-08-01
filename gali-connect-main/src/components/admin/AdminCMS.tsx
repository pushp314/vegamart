import { toast } from "sonner";
import { api } from "@/lib/api";

export function AdminCMS() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold px-1">Content Management System</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Offers Management */}
        <div className="rounded-3xl border bg-card p-6 shadow-sm flex flex-col">
          <h3 className="font-display text-lg font-bold mb-4">Create Special Offer</h3>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const fd = new FormData(form);
              try {
                await api.post("/admin/cms/offers", {
                  title: fd.get("title"),
                  sub: fd.get("sub"),
                  tag: fd.get("tag"),
                  tone: fd.get("tone"),
                });
                toast.success("Offer created!");
                form.reset();
              } catch (err) {
                toast.error("Failed to create offer");
              }
            }}
            className="space-y-4 flex-1 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <input name="title" placeholder="Offer Title (e.g., Summer Sale)" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              <input name="sub" placeholder="Subtitle" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              <input name="tag" placeholder="Tag (e.g. FLAT 50%)" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              <select name="tone" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer">
                <option value="green">Emerald Green</option>
                <option value="amber">Warm Amber</option>
                <option value="rose">Soft Rose</option>
              </select>
            </div>
            <button type="submit" className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity">Publish Offer</button>
          </form>
        </div>

        {/* Banners Management */}
        <div className="rounded-3xl border bg-card p-6 shadow-sm flex flex-col">
          <h3 className="font-display text-lg font-bold mb-4">Upload Banner</h3>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const fd = new FormData(form);
              try {
                await api.post("/admin/cms/banners", {
                  title: fd.get("title"),
                  type: fd.get("type"),
                  link_url: fd.get("link_url"),
                  image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop", // placeholder
                });
                toast.success("Banner created!");
                form.reset();
              } catch (err) {
                toast.error("Failed to create banner");
              }
            }}
            className="space-y-4 flex-1 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <input name="title" placeholder="Banner Title" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              <select name="type" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer">
                <option value="LiveNow">Live Now / Alert</option>
                <option value="Promo">Promotional Banner</option>
              </select>
              <input name="link_url" placeholder="Redirect URL (Optional)" className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              <div className="w-full h-24 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/30 text-muted-foreground text-xs font-medium cursor-not-allowed">
                Image Upload placeholder (uses stock image for now)
              </div>
            </div>
            <button type="submit" className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity">Deploy Banner</button>
          </form>
        </div>

        {/* FAQ Management */}
        <div className="rounded-3xl border bg-card p-6 shadow-sm flex flex-col md:col-span-2">
          <h3 className="font-display text-lg font-bold mb-4">Add FAQ Entry</h3>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const fd = new FormData(form);
              try {
                await api.post("/admin/cms/faqs", {
                  question: fd.get("question"),
                  answer: fd.get("answer"),
                  sort_order: parseInt(fd.get("sort_order") as string || "0"),
                });
                toast.success("FAQ created!");
                form.reset();
              } catch (err) {
                toast.error("Failed to create FAQ");
              }
            }}
            className="space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <input name="question" placeholder="Question" required className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                <input name="sort_order" type="number" placeholder="Sort Order (e.g. 1)" className="w-full h-10 px-4 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
              </div>
              <textarea name="answer" placeholder="Detailed Answer..." required className="w-full h-full min-h-[100px] px-4 py-3 rounded-xl border bg-muted/50 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"></textarea>
            </div>
            <button type="submit" className="w-auto px-8 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity">Add FAQ</button>
          </form>
        </div>

        {/* Product Sponsorship/Featuring */}
        <div className="rounded-3xl border border-primary/20 bg-primary/5 p-6 shadow-sm flex flex-col md:col-span-2">
          <h3 className="font-display text-lg font-bold mb-4 text-primary">Promote / Sponsor a Product</h3>
          <p className="text-sm text-muted-foreground mb-4">Featured products are highlighted on the Customer Homepage to increase vendor sales.</p>
          <form 
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const fd = new FormData(form);
              try {
                await api.put(`/admin/products/${fd.get("product_id")}/feature`, {
                  is_featured: fd.get("action") === "feature"
                });
                toast.success(`Product ${fd.get("action") === "feature" ? "Featured" : "Un-featured"} successfully!`);
                form.reset();
              } catch (err) {
                toast.error("Failed to update product featured status");
              }
            }}
            className="flex flex-col sm:flex-row gap-3 items-center"
          >
            <input name="product_id" placeholder="Enter Product UUID" required className="flex-1 w-full h-10 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm" />
            <select name="action" required className="w-full sm:w-auto h-10 px-4 rounded-xl border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm cursor-pointer">
              <option value="feature">Sponsor / Feature</option>
              <option value="unfeature">Remove Sponsorship</option>
            </select>
            <button type="submit" className="w-full sm:w-auto h-10 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg transition-all">Apply Status</button>
          </form>
        </div>
      </div>
    </div>
  );
}
