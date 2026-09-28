import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class CreatePaymentIntentExample {
    public static void createPaymentIntent() throws IOException {
        URL url = new URL("http://localhost:3000/payments/create-intent");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("POST");
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + accessToken);
        connection.setDoOutput(true);
        
        String jsonInput = "{"courseId":"8e4fd4f8-d8f3-46b5-8786-6f7167a654f4","amount":3999,"currency":"USD"}";
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonInput.getBytes("utf-8");
            os.write(input, 0, input.length);
        }
        
        int code = connection.getResponseCode();
        System.out.println("Response Code: " + code);
    }
    
    public static void main(String[] args) throws IOException {
        createPaymentIntent();
    }
}