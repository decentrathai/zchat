fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Only build protos when native feature is enabled
    #[cfg(feature = "native")]
    {
        // Proto files directory
        let proto_dir = std::path::PathBuf::from("proto");
        
        // Build protos if they exist
        let service_proto = proto_dir.join("service.proto");
        let compact_proto = proto_dir.join("compact_formats.proto");
        
        if service_proto.exists() && compact_proto.exists() {
            // Build gRPC client using tonic-build
            // Only compile service.proto since it imports compact_formats.proto
            // The proto_dir is passed so protoc can resolve the import
            tonic_build::configure()
                .build_server(false) // We only need the client
                .build_client(true)
                .out_dir(std::env::var("OUT_DIR").unwrap())
                .compile(&[service_proto], &[proto_dir])?;
            
            println!("cargo:rerun-if-changed=proto/service.proto");
            println!("cargo:rerun-if-changed=proto/compact_formats.proto");
        } else {
            println!("cargo:warning=Proto files not found in packages/wallet-core/proto/");
            println!("cargo:warning=Sync will not work without proto files");
        }
    }
    
    Ok(())
}

