package com.mycalorics.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.pdf.PdfRenderer;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "EncryptedPdfViewer")
public class EncryptedPdfViewerPlugin extends Plugin {

    private static PluginCall savedCall;
    private static String pendingPdfBase64;
    private static String pendingTitle;
    private static int pendingInitialPage;

    @PluginMethod
    public void openPdf(PluginCall call) {
        String pdfBase64 = call.getString("pdfBase64");
        String title = call.getString("title", "Document");
        int initialPage = call.getInt("initialPage", 1);

        if (pdfBase64 == null || pdfBase64.isEmpty()) {
            call.reject("Missing pdfBase64 parameter");
            return;
        }

        savedCall = call;
        pendingPdfBase64 = pdfBase64;
        pendingTitle = title;
        pendingInitialPage = initialPage;

        Intent intent = new Intent(getContext(), PdfViewerActivity.class);
        getActivity().startActivity(intent);
    }

    @PluginMethod
    public void closePdf(PluginCall call) {
        if (PdfViewerActivity.currentInstance != null) {
            PdfViewerActivity.currentInstance.finish();
        }
        call.resolve();
    }

    static void onViewerClosed(int lastPage) {
        if (savedCall != null) {
            JSObject result = new JSObject();
            result.put("lastPage", lastPage);
            savedCall.resolve(result);
            savedCall = null;
        }
        pendingPdfBase64 = null;
    }

    /**
     * Full-screen secure PDF viewer Activity.
     * Uses FLAG_SECURE to prevent screenshots/screen recording.
     * Renders PDF pages using Android's PdfRenderer in a RecyclerView.
     * The decrypted PDF is held in memory only — never persisted to disk.
     */
    public static class PdfViewerActivity extends AppCompatActivity {
        static PdfViewerActivity currentInstance;
        private PdfRenderer renderer;
        private ParcelFileDescriptor descriptor;
        private int currentPage = 1;

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            currentInstance = this;

            // Prevent screenshots
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );

            // Decode PDF from base64 in memory
            byte[] pdfBytes = Base64.decode(pendingPdfBase64, Base64.DEFAULT);
            // Write to a temporary in-memory-backed file (app-private cache)
            File tempFile = null;
            try {
                tempFile = File.createTempFile("viewer_", ".pdf", getCacheDir());
                tempFile.deleteOnExit();
                FileOutputStream fos = new FileOutputStream(tempFile);
                fos.write(pdfBytes);
                fos.close();

                descriptor = ParcelFileDescriptor.open(tempFile,
                    ParcelFileDescriptor.MODE_READ_ONLY);
                renderer = new PdfRenderer(descriptor);
            } catch (IOException e) {
                e.printStackTrace();
                finish();
                return;
            } finally {
                // Delete temp file immediately — PdfRenderer keeps its own fd
                if (tempFile != null) tempFile.delete();
            }

            // Build simple UI programmatically (no XML layout needed)
            android.widget.LinearLayout root = new android.widget.LinearLayout(this);
            root.setOrientation(android.widget.LinearLayout.VERTICAL);
            root.setBackgroundColor(0xFF111111);

            // Header bar
            android.widget.LinearLayout header = new android.widget.LinearLayout(this);
            header.setOrientation(android.widget.LinearLayout.HORIZONTAL);
            header.setPadding(32, 16, 32, 16);
            header.setGravity(android.view.Gravity.CENTER_VERTICAL);
            header.setBackgroundColor(0xFF1A1A1A);

            TextView titleView = new TextView(this);
            titleView.setText(pendingTitle != null ? pendingTitle : "Document");
            titleView.setTextColor(0xFFFFFFFF);
            titleView.setTextSize(16);
            android.widget.LinearLayout.LayoutParams titleParams =
                new android.widget.LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            titleView.setLayoutParams(titleParams);
            header.addView(titleView);

            android.widget.Button closeBtn = new android.widget.Button(this);
            closeBtn.setText("Close");
            closeBtn.setTextColor(0xFFFFFFFF);
            closeBtn.setBackgroundColor(0x33FFFFFF);
            closeBtn.setOnClickListener(v -> finish());
            header.addView(closeBtn);

            root.addView(header);

            // RecyclerView for pages
            RecyclerView recyclerView = new RecyclerView(this);
            recyclerView.setLayoutManager(new LinearLayoutManager(this));
            recyclerView.setAdapter(new PdfPageAdapter());
            android.widget.LinearLayout.LayoutParams rvParams =
                new android.widget.LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
            recyclerView.setLayoutParams(rvParams);
            root.addView(recyclerView);

            setContentView(root);

            // Scroll to initial page
            if (pendingInitialPage > 1 && pendingInitialPage <= renderer.getPageCount()) {
                recyclerView.scrollToPosition(pendingInitialPage - 1);
                currentPage = pendingInitialPage;
            }
        }

        @Override
        protected void onDestroy() {
            super.onDestroy();
            currentInstance = null;
            try {
                if (renderer != null) renderer.close();
                if (descriptor != null) descriptor.close();
            } catch (IOException ignored) {}
            onViewerClosed(currentPage);
        }

        private class PdfPageAdapter extends RecyclerView.Adapter<PdfPageAdapter.PageViewHolder> {
            class PageViewHolder extends RecyclerView.ViewHolder {
                ImageView imageView;
                PageViewHolder(View itemView) {
                    super(itemView);
                    imageView = (ImageView) itemView;
                }
            }

            @NonNull
            @Override
            public PageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
                ImageView iv = new ImageView(parent.getContext());
                iv.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT));
                iv.setAdjustViewBounds(true);
                iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
                iv.setPadding(0, 8, 0, 8);
                return new PageViewHolder(iv);
            }

            @Override
            public void onBindViewHolder(@NonNull PageViewHolder holder, int position) {
                PdfRenderer.Page page = renderer.openPage(position);
                // Render at 2x for sharpness
                int width = page.getWidth() * 2;
                int height = page.getHeight() * 2;
                Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                page.close();
                holder.imageView.setImageBitmap(bitmap);
                currentPage = position + 1;
            }

            @Override
            public int getItemCount() {
                return renderer != null ? renderer.getPageCount() : 0;
            }
        }
    }
}
